// Server-side file parser for CSV and XLSX.
//
// Returns a per-sheet structure: one ParsedSheet per worksheet in an XLSX
// (CSV always yields exactly one sheet). Each sheet carries both the raw row
// grid and a "logical" header/data split so downstream code can deal with
// exports where headers aren't on row 1.
//
// XLSX-specific features we lift off the file:
//   - Data validations → dropdowns/checkboxes (per column)
//   - Merged cells → used to detect "section" rows like a merged CHECK IN
//     label that groups the rows below it
//   - Multi-sheet workbooks → each tab becomes its own UAT sheet upstream
//
// CSV imports skip validations and groups entirely and just produce a single
// ParsedSheet with row 0 as the headers.

import Papa from 'papaparse'
import ExcelJS from 'exceljs'
import type { ColumnValidation } from './types'

export interface GroupRow {
  // Index into sheet.rawRows where the group header lives.
  rowIndex: number
  // The text of the group label (e.g. "CHECK IN").
  name: string
}

export interface ParsedSheet {
  // Worksheet name ("Sheet1", "Inbound", etc.). For CSV imports this is the
  // file base name without the extension.
  name: string
  // Full raw grid after stringifying cells — includes title/instruction rows,
  // the header row, group rows, and data rows. Useful for debugging + for
  // surfacing the first few rows in the preview UI.
  rawRows: string[][]
  // Logical column headers (the row we picked as the header row).
  headers: string[]
  // Data rows below the header row, with group rows filtered out. Each row
  // is padded/truncated to headers.length.
  rows: string[][]
  // Row index (0-based into rawRows) we chose as the header row. 0 for simple
  // files, >0 for files with title/instruction rows above the headers.
  headerRowIndex: number
  // Rows we detected as "section" group headers (merged cell spanning most
  // of the row, short label). Indices are into rawRows. Each group applies
  // to the data rows between it and the next group row (or end of sheet).
  groupRows: GroupRow[]
  // sourceIndex → validation. Only populated for XLSX inputs and only when
  // the source column actually has a dataValidation rule attached.
  validations: Map<number, ColumnValidation>
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[]
}

export async function parseBuffer(
  buffer: Buffer,
  kind: 'csv' | 'xlsx',
  fileName?: string,
): Promise<ParsedWorkbook> {
  if (kind === 'csv') {
    return { sheets: [parseCsv(buffer.toString('utf8'), fileName)] }
  }
  return parseXlsx(buffer)
}

function parseCsv(text: string, fileName?: string): ParsedSheet {
  const name = fileName ? fileName.replace(/\.[^.]+$/, '') : 'Sheet1'
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
  const table = result.data
    .map((r) => (r ?? []).map((c) => (c ?? '').trim()))
    .filter((r) => r.some((c) => c !== ''))

  if (table.length === 0) {
    return emptySheet(name)
  }

  const headerRowIndex = detectHeaderRowIndex(table)
  const headers = (table[headerRowIndex] ?? []).map((h) => h.trim())
  const dataRows = table
    .slice(headerRowIndex + 1)
    .map((r) => normaliseRow(r, headers.length))

  return {
    name,
    rawRows: table,
    headers,
    rows: dataRows,
    headerRowIndex,
    groupRows: [], // CSV has no merge info; groups must come from data structure
    validations: new Map(),
  }
}

async function parseXlsx(buffer: Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook()
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
  await workbook.xlsx.load(arrayBuffer)

  const sheets: ParsedSheet[] = []
  for (const sheet of workbook.worksheets) {
    if (sheet.state === 'hidden' || sheet.state === 'veryHidden') continue
    sheets.push(parseOneSheet(workbook, sheet))
  }

  return { sheets }
}

function parseOneSheet(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
): ParsedSheet {
  // Pull every row as strings. exceljs 1-indexes cells; the merged-cell
  // duplicates across the range are handy for header detection because
  // "CHECK IN" merged across 13 columns reads as 13 copies of "CHECK IN".
  const maxCol = sheet.actualColumnCount || sheet.columnCount || 0
  const rawRows: string[][] = []
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = []
    for (let c = 1; c <= maxCol; c++) {
      cells.push(stringifyCell(row.getCell(c).value).trim())
    }
    rawRows.push(cells)
  })

  // Trim leading/trailing fully-empty rows so our row indices line up with
  // "first row that has content".
  const firstContent = rawRows.findIndex((r) => r.some((c) => c !== ''))
  const trimmed = firstContent === -1 ? [] : rawRows.slice(firstContent)
  if (trimmed.length === 0) return emptySheet(sheet.name || 'Sheet')

  const merges = readMerges(sheet)
  const groupRows = detectGroupRowsFromMerges(trimmed, merges, firstContent, maxCol)
  const groupRowSet = new Set(groupRows.map((g) => g.rowIndex))

  // Pick the header row, excluding group rows (a merged banner is never the
  // header). Limit the search to the first 15 non-group rows so we don't
  // scan a whole 1000-row sheet.
  const headerRowIndex = detectHeaderRowIndex(
    trimmed,
    (i) => !groupRowSet.has(i),
  )
  const headers = (trimmed[headerRowIndex] ?? []).map((h) => h.trim())

  const dataRows: string[][] = []
  for (let i = headerRowIndex + 1; i < trimmed.length; i++) {
    if (groupRowSet.has(i)) continue // group markers aren't data
    const row = trimmed[i]
    if (row.every((c) => c === '')) continue
    dataRows.push(normaliseRow(row, headers.length))
  }

  const validations = extractColumnValidations(workbook, sheet, headers.length)

  return {
    name: sheet.name || 'Sheet',
    rawRows: trimmed,
    headers,
    rows: dataRows,
    headerRowIndex,
    groupRows,
    validations,
  }
}

function emptySheet(name: string): ParsedSheet {
  return {
    name,
    rawRows: [],
    headers: [],
    rows: [],
    headerRowIndex: 0,
    groupRows: [],
    validations: new Map(),
  }
}

// ---------------------------------------------------------------
// Header-row detection
// ---------------------------------------------------------------
// Walks the first ~15 rows and picks the row that looks most like a labels
// row. Heuristic:
//   + fill rate (more non-empty cells → better)
//   + short cells (labels are 1-6 words; title blurbs are 20+)
//   + distinct values (a row of identical "CHECK IN" copies isn't headers)
//   + is followed by at least one data row
//   - penalise rows that are all-caps single-word repetitions (section labels)
//   - penalise rows with long paragraph-style cells
//
// If nothing scores above 0 we fall back to row 0 so the caller still sees
// something. The eligibility filter lets the XLSX path exclude merged
// "banner" rows that we already classified as groups.
function detectHeaderRowIndex(
  rows: string[][],
  isEligible: (rowIndex: number) => boolean = () => true,
): number {
  const limit = Math.min(15, rows.length)
  let bestIdx = 0
  let bestScore = -Infinity

  for (let i = 0; i < limit; i++) {
    if (!isEligible(i)) continue
    const score = scoreHeaderCandidate(rows, i)
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestIdx
}

function scoreHeaderCandidate(rows: string[][], rowIndex: number): number {
  const row = rows[rowIndex] ?? []
  const width = row.length
  if (width === 0) return -Infinity

  const trimmed = row.map((c) => (c ?? '').trim())
  const nonEmpty = trimmed.filter((c) => c !== '')
  const fillRate = nonEmpty.length / width
  if (nonEmpty.length < 2) return -Infinity // a single-cell row isn't a header

  // Any subsequent row with content? Without data below, this can't be the
  // header (empty sheet, or the "header" is actually a footer).
  const hasDataBelow = rows
    .slice(rowIndex + 1)
    .some((r) => r.some((c) => c.trim() !== ''))
  if (!hasDataBelow) return -Infinity

  // Average cell length on non-empty cells.
  const avgLen =
    nonEmpty.reduce((sum, c) => sum + c.length, 0) / nonEmpty.length

  // Distinct ratio: a banner row of N identical cells has very low distinct
  // ratio. Real headers have mostly unique labels.
  const distinct = new Set(nonEmpty.map((c) => c.toLowerCase())).size
  const distinctRatio = distinct / nonEmpty.length

  // Paragraph penalty: a title/description row tends to have one very long
  // cell (>120 chars) and mostly empties.
  const hasParagraph = nonEmpty.some((c) => c.length > 120)

  let score = 0
  score += fillRate * 40 // up to +40
  score += distinctRatio * 40 // up to +40
  // Favour labels in the 3-40 char range, taper off outside.
  if (avgLen >= 3 && avgLen <= 50) score += 20
  else if (avgLen < 3) score -= 10
  else score -= Math.min(30, avgLen - 50) // long-text rows get penalised

  if (hasParagraph) score -= 40

  // Penalty for looking like a section banner (e.g. "CHECK IN" repeated).
  if (distinctRatio < 0.3) score -= 30

  return score
}

// ---------------------------------------------------------------
// Group-row detection (merged "section header" rows)
// ---------------------------------------------------------------
function readMerges(sheet: ExcelJS.Worksheet): Array<{
  top: number
  left: number
  bottom: number
  right: number
}> {
  // `merges` lives on the internal model; the public Worksheet type doesn't
  // expose it, so we reach through an untyped cast.
  const raw: string[] = (sheet as unknown as { model?: { merges?: string[] } }).model?.merges ?? []
  const out: Array<{ top: number; left: number; bottom: number; right: number }> = []
  for (const addr of raw) {
    const parsed = parseRangeAddress(addr)
    if (parsed) out.push(parsed)
  }
  return out
}

// A row is a "group header" row if a single merged range spans most of its
// width AND the non-empty cells (after accounting for merge duplication) are
// all the same short label. We then record that label.
function detectGroupRowsFromMerges(
  rawRows: string[][],
  merges: Array<{ top: number; left: number; bottom: number; right: number }>,
  firstContentRow: number,
  maxCol: number,
): GroupRow[] {
  if (rawRows.length === 0 || maxCol === 0) return []

  const result: GroupRow[] = []
  // Map from local rawRow index → merges intersecting that row.
  const mergesByLocalRow = new Map<
    number,
    Array<{ top: number; left: number; bottom: number; right: number }>
  >()
  for (const m of merges) {
    // Convert the sheet-absolute row range to rawRows-local indices.
    const localTop = m.top - 1 - firstContentRow
    const localBottom = m.bottom - 1 - firstContentRow
    for (let r = localTop; r <= localBottom; r++) {
      if (r < 0 || r >= rawRows.length) continue
      const arr = mergesByLocalRow.get(r) ?? []
      arr.push(m)
      mergesByLocalRow.set(r, arr)
    }
  }

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    const rowMerges = mergesByLocalRow.get(i) ?? []
    if (rowMerges.length === 0) continue

    // Find the widest merge that sits on this row and covers at least 50% of
    // the used columns. That's the "banner" merge.
    const widest = rowMerges
      .map((m) => ({ m, width: m.right - m.left + 1 }))
      .sort((a, b) => b.width - a.width)[0]
    if (widest.width < Math.max(3, Math.floor(maxCol * 0.5))) continue

    // Grab the merged cell's value. exceljs stores the value on the top-left
    // cell of the merge and replicates it to the others, so row[left-1] works
    // (left is 1-indexed in merges, 0-indexed in row arrays).
    const label = (row[widest.m.left - 1] ?? '').trim()
    if (!label) continue
    if (label.length > 80) continue // paragraph-style blurb, not a group name

    // Everything outside the banner merge on this row should be blank or
    // contain the same label (e.g. when two merges on the same row both say
    // "CHECK IN"). Otherwise it's a data row.
    let dissent = 0
    for (let c = 0; c < row.length; c++) {
      const v = row[c]
      if (v === '' || v === label) continue
      dissent++
    }
    if (dissent > 0) continue

    result.push({ rowIndex: i, name: label })
  }

  return result
}

function parseRangeAddress(
  addr: string,
): { top: number; left: number; bottom: number; right: number } | null {
  // e.g. "A3:M3" or "B7"
  const m = addr.match(
    /^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/,
  )
  if (!m) return null
  const left = colLettersToIndex(m[1]) + 1
  const top = parseInt(m[2], 10)
  const right = m[3] ? colLettersToIndex(m[3]) + 1 : left
  const bottom = m[4] ? parseInt(m[4], 10) : top
  return { top, left, bottom, right }
}

// ---------------------------------------------------------------
// Stringifying + misc
// ---------------------------------------------------------------
function stringifyCell(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()

  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((r) => r.text ?? '').join('')
  }
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text
  }
  if (typeof value === 'object' && 'result' in value) {
    return stringifyCell(value.result as ExcelJS.CellValue)
  }
  if (typeof value === 'object' && 'error' in value) {
    return String(value.error)
  }
  return String(value)
}

// ---------------------------------------------------------------
// Data-validation extraction (unchanged from single-sheet version)
// ---------------------------------------------------------------
function extractColumnValidations(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  columnCount: number,
): Map<number, ColumnValidation> {
  const result = new Map<number, ColumnValidation>()
  const dv = (sheet as unknown as { dataValidations?: { model?: Record<string, { type?: string; formulae?: string[] }> } }).dataValidations
  const model: Record<string, { type?: string; formulae?: string[] }> = dv?.model ?? {}
  if (Object.keys(model).length === 0) return result

  for (const [address, rule] of Object.entries(model)) {
    if (rule?.type !== 'list') continue
    const formula = rule.formulae?.[0]
    if (!formula) continue

    const options = resolveListFormula(workbook, formula)
    if (!options || options.length === 0) continue

    const normUpper = options.map((o) => o.trim().toUpperCase())
    const isBoolean =
      normUpper.length === 2 &&
      normUpper.includes('TRUE') &&
      normUpper.includes('FALSE')

    const validation: ColumnValidation = isBoolean
      ? { dataType: 'boolean' }
      : { dataType: 'list', options: dedupe(options.map((o) => o.trim()).filter((o) => o !== '')) }

    for (const colIndex of columnsFromAddress(address, columnCount)) {
      if (!result.has(colIndex)) result.set(colIndex, validation)
    }
  }

  return result
}

function columnsFromAddress(address: string, columnCount: number): number[] {
  const bare = address.replace(/^(?:'[^']+'|[^!]+)!/, '')
  const cols = new Set<number>()
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

function colLettersToIndex(letters: string): number {
  let n = 0
  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

function resolveListFormula(
  workbook: ExcelJS.Workbook,
  formula: string,
): string[] | null {
  const trimmed = formula.trim().replace(/^=/, '')

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const inner = trimmed.slice(1, -1)
    return inner.split(',').map((s) => s.trim())
  }

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

function parseCellRef(ref: string): { row: number; col: number } {
  const match = ref.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/)
  if (!match) return { row: 1, col: 1 }
  return { col: colLettersToIndex(match[1]) + 1, row: parseInt(match[2], 10) }
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function normaliseRow(row: string[], width: number): string[] {
  const trimmed = row.map((c) => (c ?? '').trim())
  if (trimmed.length === width) return trimmed
  if (trimmed.length > width) return trimmed.slice(0, width)
  return [...trimmed, ...Array(width - trimmed.length).fill('')]
}
