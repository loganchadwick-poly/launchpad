'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/getUser'
import { parseBuffer } from '@/lib/uat-import/parser'
import { mapHeadersWithAI } from '@/lib/uat-import/anthropic-mapper'
import { transformRows, mergeColumnConfig } from '@/lib/uat-import/transform'
import type {
  ColumnMapping,
  ImportPreview,
  ImportResult,
} from '@/lib/uat-import/types'
import type { UATColumn } from '@/lib/types/database.types'

// =====================================================
// Step 1: previewImport
// =====================================================
// Parses the uploaded file, runs AI header mapping, returns a preview
// payload the client can show to the user. Also returns the raw file
// base64-encoded so confirmImport doesn't need a second upload.
export async function previewImport(formData: FormData): Promise<
  | { success: true; preview: ImportPreview }
  | { success: false; error: string }
> {
  try {
    await requireAuth()

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'No file uploaded.' }
    if (file.size === 0) return { success: false, error: 'File is empty.' }
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'File too large (max 5 MB).' }
    }

    const kind = detectKind(file.name, file.type)
    if (!kind) {
      return { success: false, error: 'Unsupported file type. Upload a .csv or .xlsx.' }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseBuffer(buffer, kind)
    if (parsed.headers.length === 0) {
      return { success: false, error: 'Could not find a header row in the file.' }
    }
    if (parsed.rows.length === 0) {
      return { success: false, error: 'File has a header row but no data rows.' }
    }

    const sampleRows = parsed.rows.slice(0, 5)
    const mappings = await mapHeadersWithAI(
      parsed.headers,
      sampleRows,
      parsed.validations,
    )

    const warnings: string[] = []
    const lowConfidence = mappings.filter((m) => m.confidence === 'low' && !m.skip)
    if (lowConfidence.length > 0) {
      warnings.push(
        `${lowConfidence.length} column${lowConfidence.length === 1 ? '' : 's'} mapped with low confidence — review before importing.`,
      )
    }

    return {
      success: true,
      preview: {
        headers: parsed.headers,
        mappings,
        totalRows: parsed.rows.length,
        sampleRows,
        fileName: file.name,
        payloadB64: buffer.toString('base64'),
        payloadKind: kind,
        warnings,
      },
    }
  } catch (err) {
    console.error('[uat-import] previewImport failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to preview import.',
    }
  }
}

// =====================================================
// Step 2: confirmImport
// =====================================================
// Re-parses the file from the base64 payload, applies the (possibly
// user-edited) mappings, dedupes against existing cases, bulk-inserts
// cases + rounds, and updates the sheet's column_config.
export async function confirmImport(input: {
  uatSheetId: string
  payloadB64: string
  payloadKind: 'csv' | 'xlsx'
  mappings: ColumnMapping[]
}): Promise<
  | { success: true; result: ImportResult }
  | { success: false; error: string }
> {
  try {
    await requireAuth()
    const supabase = await createClient()

    // Load sheet + existing column_config + existing cases for dedupe.
    const { data: sheet, error: sheetErr } = await supabase
      .from('uat_sheets')
      .select('id, column_config')
      .eq('id', input.uatSheetId)
      .single()
    if (sheetErr || !sheet) {
      return { success: false, error: 'UAT sheet not found.' }
    }

    const { data: existing, error: existingErr } = await supabase
      .from('uat_test_cases')
      .select('row_number, test_label, test_script, extra_fields')
      .eq('uat_sheet_id', input.uatSheetId)
    if (existingErr) {
      return { success: false, error: existingErr.message }
    }

    const existingKeys = new Set(
      (existing ?? []).map((c) => dedupeKey(c.test_label, c.test_script)),
    )
    const maxRow = (existing ?? []).reduce(
      (m, c) => Math.max(m, c.row_number ?? 0),
      0,
    )

    // Re-parse from payload.
    const buffer = Buffer.from(input.payloadB64, 'base64')
    const parsed = await parseBuffer(buffer, input.payloadKind)

    const {
      cases,
      skippedEmpty,
      rowWarnings,
      customColumnsSeen,
    } = transformRows(parsed.rows, input.mappings, maxRow + 1)

    // Skip exact duplicates only (same test_label + test_script).
    const deduped = cases.filter(
      (c) => !existingKeys.has(dedupeKey(c.test_label, c.test_script)),
    )
    const skippedDuplicates = cases.length - deduped.length

    if (deduped.length === 0) {
      return {
        success: true,
        result: {
          inserted: 0,
          skippedEmpty,
          skippedDuplicates,
          warnings: ['No new rows to insert (all were empty or duplicates).'],
          newColumnConfig: sheet.column_config as UATColumn[],
        },
      }
    }

    // Insert cases first to get IDs, then rounds in a second pass.
    const casesToInsert = deduped.map((c) => ({
      uat_sheet_id: input.uatSheetId,
      row_number: c.rowNumber,
      test_label: c.test_label,
      test_script: c.test_script,
      tester_phone: c.tester_phone,
      polyai_resolution_comments: c.polyai_resolution_comments,
      ready_to_retest: c.ready_to_retest,
      extra_fields: c.extra_fields,
    }))

    const { data: insertedCases, error: insertErr } = await supabase
      .from('uat_test_cases')
      .insert(casesToInsert)
      .select('id, row_number')

    if (insertErr || !insertedCases) {
      return {
        success: false,
        error: insertErr?.message ?? 'Insert failed.',
      }
    }

    // Match inserted rows back to prepared cases by row_number (unique per sheet).
    const idByRow = new Map<number, string>()
    for (const c of insertedCases) idByRow.set(c.row_number, c.id)

    const roundsToInsert = deduped.flatMap((c) => {
      const caseId = idByRow.get(c.rowNumber)
      if (!caseId) return []
      return c.rounds.map((r) => ({
        test_case_id: caseId,
        round_number: r.round_number,
        tester_name: r.tester_name,
        call_link: r.call_link,
        result: r.result,
        comments: r.comments,
        extra_fields: r.extra_fields,
      }))
    })

    if (roundsToInsert.length > 0) {
      const { error: roundsErr } = await supabase
        .from('uat_test_rounds')
        .insert(roundsToInsert)
      if (roundsErr) {
        return { success: false, error: `Rounds insert failed: ${roundsErr.message}` }
      }
    }

    // Update column_config. Merge incoming custom columns with existing,
    // then (per Logan's requirement) drop custom columns that have no data
    // anywhere in the sheet.
    const merged = mergeColumnConfig(
      sheet.column_config as UATColumn[],
      customColumnsSeen,
    )
    const final = await pruneEmptyCustomColumns(
      supabase,
      input.uatSheetId,
      merged,
    )

    const { error: cfgErr } = await supabase
      .from('uat_sheets')
      .update({ column_config: final })
      .eq('id', input.uatSheetId)
    if (cfgErr) {
      return { success: false, error: `Column config update failed: ${cfgErr.message}` }
    }

    revalidatePath(`/uat-sheets/${input.uatSheetId}`)

    const warnings = [...rowWarnings]
    if (skippedEmpty > 0) warnings.unshift(`Skipped ${skippedEmpty} empty row${skippedEmpty === 1 ? '' : 's'}.`)
    if (skippedDuplicates > 0) warnings.unshift(`Skipped ${skippedDuplicates} duplicate row${skippedDuplicates === 1 ? '' : 's'}.`)

    return {
      success: true,
      result: {
        inserted: insertedCases.length,
        skippedEmpty,
        skippedDuplicates,
        warnings,
        newColumnConfig: final,
      },
    }
  } catch (err) {
    console.error('[uat-import] confirmImport failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to import.',
    }
  }
}

// =====================================================
// Helpers
// =====================================================

function detectKind(name: string, mime: string): 'csv' | 'xlsx' | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.csv') || mime === 'text/csv') return 'csv'
  if (
    lower.endsWith('.xlsx') ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx'
  }
  return null
}

function dedupeKey(label: string, script: string): string {
  return `${(label ?? '').trim().toLowerCase()}|${(script ?? '').trim().toLowerCase()}`
}

// After insert, scan all cases + rounds for which custom keys actually have
// any non-empty value. Drop custom columns from column_config that have no
// data anywhere — this covers Logan's "if the uploaded sheet has no API Data
// column, the column should be removed" case, without wiping columns that
// have real data in cases not touched by this import.
type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function pruneEmptyCustomColumns(
  supabase: SupabaseClient,
  uatSheetId: string,
  config: UATColumn[],
): Promise<UATColumn[]> {
  const customKeys = config.filter((c) => c.kind === 'custom').map((c) => c.key)
  if (customKeys.length === 0) return config

  const { data: cases } = await supabase
    .from('uat_test_cases')
    .select('extra_fields')
    .eq('uat_sheet_id', uatSheetId)

  const { data: rounds } = await supabase
    .from('uat_test_rounds')
    .select('extra_fields, test_case_id, uat_test_cases!inner(uat_sheet_id)')
    .eq('uat_test_cases.uat_sheet_id', uatSheetId)

  const keysWithData = new Set<string>()
  for (const row of cases ?? []) {
    const ef = (row.extra_fields ?? {}) as Record<string, string>
    for (const [k, v] of Object.entries(ef)) {
      if (v && String(v).trim() !== '') keysWithData.add(k)
    }
  }
  for (const row of rounds ?? []) {
    const ef = (row.extra_fields ?? {}) as Record<string, string>
    for (const [k, v] of Object.entries(ef)) {
      if (v && String(v).trim() !== '') keysWithData.add(k)
    }
  }

  return config.filter((c) => c.kind === 'core' || keysWithData.has(c.key))
}
