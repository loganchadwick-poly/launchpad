// Shared types for the UAT CSV/XLSX import pipeline.

import type { UATColumn, UATColumnDataType, UATResult } from '@/lib/types/database.types'

// Data-validation info lifted from an XLSX source column. CSV imports never
// populate this (CSV is plain text and can't carry validation rules).
export interface ColumnValidation {
  dataType: UATColumnDataType
  options?: string[] // only when dataType === 'list'
}

// A "section header" row (e.g. "CHECK IN" merged across most of the row).
// rowIndex is into the sheet's rawRows grid — the parser tells us which
// data rows follow each group header.
export interface GroupRow {
  rowIndex: number
  name: string
}

// A single mapped column from the source file to the target schema.
export interface ColumnMapping {
  sourceHeader: string // Raw header text from the file
  sourceIndex: number // Column index in the parsed rows
  targetKey: string // e.g. "test_label" or "api_data"
  label: string // Human label (mirrors sourceHeader by default; cleaned up for custom)
  kind: 'core' | 'custom'
  level: 'case' | 'round'
  round: number | null // 1 for initial, 2 for retest columns, null for case-level
  confidence: 'high' | 'low' // AI confidence; 'low' surfaces a warning in preview
  skip: boolean // True if user marked this column to be ignored
  // Data validation lifted from the source column (XLSX only). Core columns
  // use fixed enums and ignore this; custom columns use it to render
  // dropdowns/checkboxes in the table.
  validation?: ColumnValidation
}

// Preview for a single worksheet within the uploaded file.
export interface SheetPreview {
  sheetName: string
  headers: string[]
  mappings: ColumnMapping[]
  totalRows: number
  sampleRows: string[][] // First ~5 rows, cell values as strings
  groupRows: GroupRow[] // Section headers detected in this sheet (info only in preview)
  groupRowCount: number
  warnings: string[]
}

// Output of the parse+map step for the whole workbook. The UI shows one tab
// per sheet and lets the user edit each sheet's mappings independently.
export interface ImportPreview {
  sheets: SheetPreview[]
  fileName: string
  // Base64-encoded source buffer. Passed back on confirm so we don't have to
  // re-upload the file. Small UAT sheets are rarely over a few hundred KB.
  payloadB64: string
  payloadKind: 'csv' | 'xlsx'
  warnings: string[]
}

// What the bulk insert step produces per row.
export interface PreparedCase {
  rowNumber: number
  test_label: string
  test_script: string
  tester_phone: string
  polyai_resolution_comments: string
  ready_to_retest: boolean
  extra_fields: Record<string, string>
  rounds: PreparedRound[]
  // Grouping: when a row sits under a "CHECK IN" merged banner, group_name
  // is set and the row is treated as a child of a synthetic parent case.
  // parentKey is a stable identifier for the parent so the DB insert layer
  // can link children to parents via parent_row_id after the parents get
  // their real UUIDs.
  group_name: string | null
  parent_key: string | null // non-null on children; null on parents and ungrouped rows
  is_group_parent: boolean // true only for the synthetic parent row
}

export interface PreparedRound {
  round_number: number
  tester_name: string
  call_link: string
  result: UATResult | null
  comments: string
  extra_fields: Record<string, string>
}

export interface ImportResult {
  // Per-sheet result. The first entry is the sheet the user was on when they
  // clicked Import; the rest are newly-created sibling UAT sheets.
  sheets: Array<{
    sheetName: string // name of the source worksheet
    uatSheetId: string // UAT sheet id (existing or newly created)
    uatSheetName: string // UAT sheet name as stored in the DB
    isNew: boolean // true if we created this UAT sheet for the import
    inserted: number
    skippedEmpty: number
    skippedDuplicates: number
    warnings: string[]
    newColumnConfig: UATColumn[]
  }>
  totalInserted: number
  warnings: string[]
}
