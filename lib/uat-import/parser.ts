// Server-side file parser for CSV and XLSX.
// Always produces { headers: string[], rows: string[][] } — headers are the
// first non-empty row, rows are everything else (still string-valued so the
// AI mapper sees the same raw shape the user sees).
//
// XLSX: uses exceljs (not SheetJS community) so we can lift data-validation
// rules off each column — dropdowns and Google Sheets–style checkboxes turn
// into real dropdowns/checkboxes in the UAT sheet table. CSV imports can't
// carry validation rules (format is plain text), so validations is empty
// for CSVs.

import Papa from 'papaparse'
import ExcelJS from 'exceljs'
import type { ColumnValidation } from './types'

export interface ParsedFile {
  headers: string[]
  rows: string[][]
  // sourceIndex → validation. Only ever populated for XLSX inputs and only
  // when the source column actually has a dataValidation rule attached.
  validations: Map<number, ColumnValidation>
}

export async function parseBuffer(
  buffer: Buffer,
  kind: 'csv' | 'xlsx',
): Promise<ParsedFile> {
  if (kind === 'csv') {
    return parseCsv(buffer.toString('utf8'))
  }
  return parseXlsx(buffer)
}

function parseCsv(text: string): ParsedFile {
  // skipEmptyLines: 'greedy' drops rows that are completely blank *and* rows
  // where every cell is just whitespace. We still need a second pass below to
  // drop rows that PapaParse kept because they had a delimiter but no content.
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
  })
  const table = result.data.filter((r) => r.some((c) => (c ?? '').trim() !== ''))
  if (table.length === 0) return { headers: [], rows: [], validations: new Map() }
  const headers = (table[0] ?? []).map((h) => (h ?? '').trim())
  const rows = table.slice(1).map((r) => normaliseRow(r, headers.length))
  return { headers, rows, validations: new Map() }
}

async function parseXlsx(buffer: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook()
  // Node Buffer → ArrayBuffer slice so exceljs sees it as a binary input.
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
  await workbook.xlsx.load(arrayBuffer)

  const sheet = workbook.worksheets[0]
  if (!sheet) return { headers: [], rows: [], validations: new Map() }

  // Collect rows as string-valued arrays. exceljs 1-indexes everything, so
  // row 1 col 1 is the top-left cell. We want an array-of-arrays shape.
  const rawRows: string[][] = []
  const maxCol = sheet.actualColumnCount || sheet.columnCount || 0
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = []
    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c)
      cells.push(stringifyCell(cell.value))
    }
    rawRows.push(cells)
  })

  const nonEmpty = rawRows.filter((r) => r.some((c) => c.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [], validations: new Map() }

  const headers = nonEmpty[0].map((h) => h.trim())
  const dataRows = nonEmpty.slice(1).map((r) => normaliseRow(r, headers.length))

  // Walk the sheet's data validations. exceljs stores them as a map of
  // cell/range address → validation rule. We reduce this to one validation
  // per header column (0-indexed) so the mapper + transform can use it.
  const validations = extractColumnValidations(
    workbook,
    sheet,
    headers.length,
    dataRows,
  )

  return { headers, rows: dataRows, validations }
}

// Stringify an exceljs cell value so it looks like what the user sees in Excel.
// Handles: strings, numbers, booleans, Dates, rich text, formula results,
// hyperlinks.
function stringifyCell(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()

  // Rich text: join all run texts
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((r) => r.text ?? '').join('')
  }
  // Hyperlink: prefer the visible text, fall back to the URL
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text
  }
  // Formula result
  if (typeof value === 'object' && 'result' in value) {
    return stringifyCell(value.result as ExcelJS.CellValue)
  }
  // Error
  if (typeof value === 'object' && 'error' in value) {
    return String(value.error)
  }

  return String(value)
}

// exceljs data validation model:
//   sheet.dataValidations.model = {
//     'B2:B100': { type: 'list', allowBlank, formulae: ['"Pass,Fail,Blocked"'] },
//     'C2:C100': { type: 'list', formulae: ['Sheet2!$A$1:$A$5'] },
//     'D2':     { type: 'list', formulae: ['"TRUE,FALSE"'] },
//   }
// We want: for each header column index, compute a ColumnValidation if ANY
// cell in that column (below the header) has a list-type validation.
function extractColumnValidations(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  columnCount: number,
  _dataRows: string[][],
): Map<number, ColumnValidation> {
  const result = new Map<number, ColumnValidation>()

  // exceljs's public types don't expose dataValidations; it's stable on the
  // runtime object (see workbook-reader → DataValidations.model).
  const dv = (sheet as unknown as { dataValidations?: { model?: Record<string, { type?: string; formulae?: string[] }> } }).dataValidations
  const model: Record<string, { type?: string; formulae?: string[] }> = dv?.model ?? {}

  if (Object.keys(model).length === 0) return result

  for (const [address, rule] of Object.entries(model)) {
    if (rule?.type !== 'list') continue
    const formula = rule.formulae?.[0]
    if (!formula) continue

    const options = resolveListFormula(workbook, formula)
    if (!options || options.length === 0) continue

    // Google Sheets checkboxes: validation list of exactly TRUE/FALSE →
    // treat the whole column as boolean.
    const normUpper = options.map((o) => o.trim().toUpperCase())
    const isBoolean =
      normUpper.length === 2 &&
      normUpper.includes('TRUE') &&
      normUpper.includes('FALSE')

    const validation: ColumnValidation = isBoolean
      ? { dataType: 'boolean' }
      : { dataType: 'list', options: dedupe(options.map((o) => o.trim()).filter((o) => o !== '')) }

    // Map the address back to one or more column indices (0-based).
    for (const colIndex of columnsFromAddress(address, columnCount)) {
      // Prefer the first validation we see per column; warn on conflict.
      if (!result.has(colIndex)) result.set(colIndex, validation)
    }
  }

  return result
}

// "B2:B100"  → [1]
// "A1:D1"    → [0, 1, 2, 3]
// "'Sheet1'!B2:B100" → [1]
// Treats all columns spanned by the range. Filters out indices ≥ columnCount
// so we don't invent phantom columns.
function columnsFromAddress(address: string, columnCount: number): number[] {
  // Strip sheet qualifier like 'Sheet1'! or Sheet1!
  const bare = address.replace(/^(?:'[^']+'|[^!]+)!/, '')

  const cols = new Set<number>()
  // A range may be multiple comma-separated parts, e.g. "B2:B10,D2:D10"
  for (const part of bare.split(',')) {
    const match = part.trim().match(/^\$?([A-Z]+)\$?\d+(?::\$?([A-Z]+)\$?\d+)?$/)
    if (!match) continue
    const startCol = colLettersToIndex(match[1])
    const endCol = match[2] ? colLettersToIndex(match[2]) : startCol
    const [lo, hi] = startCol <= endCol ? [startCol, endCol] : [endCol, startCol]
    for (let c = lo; c <= hi; c++) {
      if (c < columnCount) cols.add(c)
    }
  }
  return Array.from(cols)
}

// "A"=0, "B"=1, ..., "Z"=25, "AA"=26, ...
function colLettersToIndex(letters: string): number {
  let n = 0
  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

// Given a data-validation list formula, return the concrete option values.
// Supported shapes:
//   - Inline:  `"Option1,Option2,Option3"`  (quoted, comma-separated)
//   - Range:   `Sheet2!$A$1:$A$5`           (cells in another sheet)
//   - Range:   `$A$1:$A$5`                   (same sheet)
// Returns null on unresolvable formulas so the caller can skip the column.
function resolveListFormula(
  workbook: ExcelJS.Workbook,
  formula: string,
): string[] | null {
  const trimmed = formula.trim().replace(/^=/, '')

  // Inline list: "a,b,c" (Excel wraps each option in the same quoted string)
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const inner = trimmed.slice(1, -1)
    return inner.split(',').map((s) => s.trim())
  }

  // Range reference
  const rangeMatch = trimmed.match(
    /^(?:'([^']+)'|([A-Za-z0-9_ ]+))!(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?\d+)$/,
  )
  let targetSheet: ExcelJS.Worksheet | undefined
  let rangeStart: string
  let rangeEnd: string
  if (rangeMatch) {
    const sheetName = rangeMatch[1] ?? rangeMatch[2]
    targetSheet = workbook.getWorksheet(sheetName)
    rangeStart = rangeMatch[3]
    rangeEnd = rangeMatch[4]
  } else {
    const sameSheetMatch = trimmed.match(/^(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?\d+)$/)
    if (!sameSheetMatch) return null
    targetSheet = workbook.worksheets[0]
    rangeStart = sameSheetMatch[1]
    rangeEnd = sameSheetMatch[2]
  }
  if (!targetSheet) return null

  const { row: r1, col: c1 } = parseCellRef(rangeStart)
  const { row: r2, col: c2 } = parseCellRef(rangeEnd)
  const [rowLo, rowHi] = r1 <= r2 ? [r1, r2] : [r2, r1]
  const [colLo, colHi] = c1 <= c2 ? [c1, c2] : [c2, c1]

  const values: string[] = []
  for (let r = rowLo; r <= rowHi; r++) {
    for (let c = colLo; c <= colHi; c++) {
      const cell = targetSheet.getCell(r, c)
      const s = stringifyCell(cell.value).trim()
      if (s !== '') values.push(s)
    }
  }
  return values
}

// "A1" → { row: 1, col: 1 }. Strips "$" absolute-reference markers.
function parseCellRef(ref: string): { row: number; col: number } {
  const match = ref.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/)
  if (!match) return { row: 1, col: 1 }
  return { col: colLettersToIndex(match[1]) + 1, row: parseInt(match[2], 10) }
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

// Pad or truncate so every row has exactly `width` cells. Keeps downstream
// indexing safe when a file has ragged rows.
function normaliseRow(row: string[], width: number): string[] {
  const trimmed = row.map((c) => (c ?? '').trim())
  if (trimmed.length === width) return trimmed
  if (trimmed.length > width) return trimmed.slice(0, width)
  return [...trimmed, ...Array(width - trimmed.length).fill('')]
}
