// Shared types for the UAT CSV/XLSX import pipeline.

import type { UATColumn, UATResult } from '@/lib/types/database.types'

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
}

// Output of the parse+map step. Sent back to the client for preview.
export interface ImportPreview {
  headers: string[]
  mappings: ColumnMapping[]
  totalRows: number
  sampleRows: string[][] // First ~5 rows, cell values as strings
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
  inserted: number
  skippedEmpty: number
  skippedDuplicates: number
  warnings: string[]
  newColumnConfig: UATColumn[]
}
