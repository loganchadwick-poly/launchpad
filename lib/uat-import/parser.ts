// Server-side file parser for CSV and XLSX.
// Always produces { headers: string[], rows: string[][] } — headers are the
// first non-empty row, rows are everything else (still string-valued so the
// AI mapper sees the same raw shape the user sees).

import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface ParsedFile {
  headers: string[]
  rows: string[][]
}

export function parseBuffer(
  buffer: Buffer,
  kind: 'csv' | 'xlsx',
): ParsedFile {
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
  if (table.length === 0) return { headers: [], rows: [] }
  const headers = (table[0] ?? []).map((h) => (h ?? '').trim())
  const rows = table.slice(1).map((r) => normaliseRow(r, headers.length))
  return { headers, rows }
}

function parseXlsx(buffer: Buffer): ParsedFile {
  // cellDates:true → Excel date cells come back as JS Date objects we can
  // .toISOString() instead of a cryptic Excel serial number.
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const sheet = workbook.Sheets[sheetName]

  // header:1 gives us array-of-arrays like PapaParse. defval:'' prevents
  // undefined cells from collapsing the row length.
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as unknown[][]

  const stringified = table.map((r) =>
    r.map((c) => {
      if (c instanceof Date) return c.toISOString()
      if (c === null || c === undefined) return ''
      return String(c)
    }),
  )
  const nonEmpty = stringified.filter((r) => r.some((c) => c.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }
  const headers = nonEmpty[0].map((h) => h.trim())
  const rows = nonEmpty.slice(1).map((r) => normaliseRow(r, headers.length))
  return { headers, rows }
}

// Pad or truncate so every row has exactly `width` cells. Keeps downstream
// indexing safe when a file has ragged rows.
function normaliseRow(row: string[], width: number): string[] {
  const trimmed = row.map((c) => (c ?? '').trim())
  if (trimmed.length === width) return trimmed
  if (trimmed.length > width) return trimmed.slice(0, width)
  return [...trimmed, ...Array(width - trimmed.length).fill('')]
}
