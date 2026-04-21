'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/getUser'
import { parseBuffer, type ParsedSheet } from '@/lib/uat-import/parser'
import { mapHeadersWithAI } from '@/lib/uat-import/anthropic-mapper'
import { transformRows, mergeColumnConfig } from '@/lib/uat-import/transform'
import { createEmptyUATSheet } from './uat'
import type {
  ColumnMapping,
  ImportPreview,
  ImportResult,
  PreparedCase,
  SheetPreview,
} from '@/lib/uat-import/types'
import type { UATColumn } from '@/lib/types/database.types'

// =====================================================
// Step 1: previewImport
// =====================================================
// Parses the uploaded file (every worksheet for XLSX, single sheet for CSV),
// runs AI header mapping per sheet, and returns a per-sheet preview payload.
// The raw file is base64-encoded into the payload so confirmImport doesn't
// have to re-upload.
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
    const workbook = await parseBuffer(buffer, kind, file.name)

    // Drop sheets that have no usable data; warn if we dropped any.
    const topWarnings: string[] = []
    const usableSheets = workbook.sheets.filter((s) => {
      if (s.headers.length === 0 || s.rows.length === 0) {
        topWarnings.push(`Skipped sheet "${s.name}" — no usable header or data rows.`)
        return false
      }
      return true
    })
    if (usableSheets.length === 0) {
      return {
        success: false,
        error:
          workbook.sheets.length === 0
            ? 'No worksheets found in the file.'
            : 'No worksheets have both a header row and data rows.',
      }
    }

    const sheetPreviews: SheetPreview[] = []
    for (const s of usableSheets) {
      const sampleRows = s.rows.slice(0, 5)
      const mappings = await mapHeadersWithAI(s.headers, sampleRows, s.validations)

      const perSheetWarnings: string[] = []
      const lowConfidence = mappings.filter((m) => m.confidence === 'low' && !m.skip)
      if (lowConfidence.length > 0) {
        perSheetWarnings.push(
          `${lowConfidence.length} column${lowConfidence.length === 1 ? '' : 's'} mapped with low confidence — review before importing.`,
        )
      }
      if (s.groupRows.length > 0) {
        perSheetWarnings.push(
          `Detected ${s.groupRows.length} section header${s.groupRows.length === 1 ? '' : 's'} (${s.groupRows.map((g) => `"${g.name}"`).join(', ')}) — rows will be grouped under these.`,
        )
      }
      if (s.headerRowIndex > 0) {
        perSheetWarnings.push(
          `Header row detected on row ${s.headerRowIndex + 1}; rows above were ignored.`,
        )
      }

      sheetPreviews.push({
        sheetName: s.name,
        headers: s.headers,
        mappings,
        totalRows: s.rows.length,
        sampleRows,
        groupRows: s.groupRows,
        groupRowCount: s.groupRows.length,
        warnings: perSheetWarnings,
      })
    }

    return {
      success: true,
      preview: {
        sheets: sheetPreviews,
        fileName: file.name,
        payloadB64: buffer.toString('base64'),
        payloadKind: kind,
        warnings: topWarnings,
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
// For each sheet in the payload the user confirmed, decide where the data
// lands:
//   - First sheet → populates the UAT sheet the user was on when they clicked
//     Import (reuses the current page so the UX feels natural).
//   - Subsequent sheets → create new sibling UAT sheets on the same deployment,
//     one per tab, named after the source tab.
// Then insert cases + rounds, linking group parent/child rows as we go.
export async function confirmImport(input: {
  uatSheetId: string // the sheet the user is currently on
  payloadB64: string
  payloadKind: 'csv' | 'xlsx'
  sheets: Array<{ sheetName: string; mappings: ColumnMapping[] }>
}): Promise<
  | { success: true; result: ImportResult }
  | { success: false; error: string }
> {
  try {
    await requireAuth()
    const supabase = await createClient()

    // Figure out the deployment for the current sheet so we can create
    // siblings under the same deployment for tabs 2+.
    const { data: currentSheet, error: currentErr } = await supabase
      .from('uat_sheets')
      .select('id, name, deployment_id, column_config')
      .eq('id', input.uatSheetId)
      .single()
    if (currentErr || !currentSheet) {
      return { success: false, error: 'UAT sheet not found.' }
    }

    // Re-parse the workbook so we have fresh row data + group info.
    const buffer = Buffer.from(input.payloadB64, 'base64')
    const workbook = await parseBuffer(buffer, input.payloadKind)

    // Build a quick lookup by sheetName so the user-confirmed mappings pair
    // up with the right parsed sheet (order-independent, robust to UI reorder).
    const parsedBySheetName = new Map<string, ParsedSheet>()
    for (const s of workbook.sheets) parsedBySheetName.set(s.name, s)

    const sheetResults: ImportResult['sheets'] = []
    const topWarnings: string[] = []

    for (let sheetIdx = 0; sheetIdx < input.sheets.length; sheetIdx++) {
      const userSheet = input.sheets[sheetIdx]
      const parsed = parsedBySheetName.get(userSheet.sheetName)
      if (!parsed) {
        topWarnings.push(`Sheet "${userSheet.sheetName}" not found in the uploaded file — skipped.`)
        continue
      }

      // Target UAT sheet: first sheet reuses current; subsequent sheets get
      // a freshly-created empty sibling.
      let targetId: string
      let targetName: string
      let targetColumnConfig: UATColumn[]
      let isNew = false

      if (sheetIdx === 0) {
        targetId = currentSheet.id
        targetName = currentSheet.name
        targetColumnConfig = (currentSheet.column_config as UATColumn[]) ?? []
      } else {
        const created = await createEmptyUATSheet(
          currentSheet.deployment_id,
          uniqueSheetName(currentSheet.name, userSheet.sheetName),
        )
        if ('error' in created) {
          topWarnings.push(`Could not create a new UAT sheet for "${userSheet.sheetName}": ${created.error}`)
          continue
        }
        targetId = created.id
        targetName = uniqueSheetName(currentSheet.name, userSheet.sheetName)
        targetColumnConfig = []
        isNew = true
      }

      const result = await importOneSheet({
        parsed,
        mappings: userSheet.mappings,
        targetUatSheetId: targetId,
        targetColumnConfig,
      })
      if ('error' in result) {
        topWarnings.push(`Sheet "${userSheet.sheetName}" failed: ${result.error}`)
        continue
      }

      sheetResults.push({
        sheetName: userSheet.sheetName,
        uatSheetId: targetId,
        uatSheetName: targetName,
        isNew,
        inserted: result.inserted,
        skippedEmpty: result.skippedEmpty,
        skippedDuplicates: result.skippedDuplicates,
        warnings: result.warnings,
        newColumnConfig: result.newColumnConfig,
      })
    }

    revalidatePath(`/uat-sheets/${input.uatSheetId}`)
    if (currentSheet.deployment_id) {
      revalidatePath(`/deployments/${currentSheet.deployment_id}`)
    }

    return {
      success: true,
      result: {
        sheets: sheetResults,
        totalInserted: sheetResults.reduce((sum, s) => sum + s.inserted, 0),
        warnings: topWarnings,
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
// Per-sheet insert pipeline
// =====================================================
async function importOneSheet(opts: {
  parsed: ParsedSheet
  mappings: ColumnMapping[]
  targetUatSheetId: string
  targetColumnConfig: UATColumn[]
}): Promise<
  | {
      inserted: number
      skippedEmpty: number
      skippedDuplicates: number
      warnings: string[]
      newColumnConfig: UATColumn[]
    }
  | { error: string }
> {
  const supabase = await createClient()

  // Pull existing cases for dedupe. New UAT sheets are always empty, but
  // re-using the current sheet can have prior rows.
  const { data: existing, error: existingErr } = await supabase
    .from('uat_test_cases')
    .select('row_number, test_label, test_script, extra_fields')
    .eq('uat_sheet_id', opts.targetUatSheetId)
  if (existingErr) return { error: existingErr.message }

  const existingKeys = new Set(
    (existing ?? []).map((c) => dedupeKey(c.test_label, c.test_script)),
  )
  const maxRow = (existing ?? []).reduce(
    (m, c) => Math.max(m, c.row_number ?? 0),
    0,
  )

  // Compute data-row → rawRow mapping so transform can associate each data
  // row with the group row (banner) sitting above it.
  const groupRowSet = new Set(opts.parsed.groupRows.map((g) => g.rowIndex))
  const dataRowRawIndex: number[] = []
  for (let i = opts.parsed.headerRowIndex + 1; i < opts.parsed.rawRows.length; i++) {
    if (groupRowSet.has(i)) continue
    const row = opts.parsed.rawRows[i]
    if (row.every((c) => c.trim() === '')) continue
    dataRowRawIndex.push(i)
  }

  const { cases, skippedEmpty, rowWarnings, customColumnsSeen } = transformRows({
    rows: opts.parsed.rows,
    dataRowRawIndex,
    groupRows: opts.parsed.groupRows,
    mappings: opts.mappings,
    startingRowNumber: maxRow + 1,
  })

  // All cases are regular test cases now. Group banners (CHECK IN / CHECK OUT
  // / etc.) are captured via `group_name` on each row rather than as a
  // standalone parent row. The UI renders the banner by grouping consecutive
  // rows that share the same `group_name`.
  const deduped = cases.filter(
    (c) => !existingKeys.has(dedupeKey(c.test_label, c.test_script)),
  )
  const skippedDuplicates = cases.length - deduped.length

  if (deduped.length === 0) {
    return {
      inserted: 0,
      skippedEmpty,
      skippedDuplicates,
      warnings: ['No new rows to insert (all were empty or duplicates).'],
      newColumnConfig: opts.targetColumnConfig,
    }
  }

  // ------------------ Insert cases ------------------
  const insertedCaseIdByRow = new Map<number, string>()
  const caseRows = deduped.map((c) => ({
    uat_sheet_id: opts.targetUatSheetId,
    row_number: c.rowNumber,
    test_label: c.test_label,
    test_script: c.test_script,
    tester_phone: c.tester_phone,
    polyai_resolution_comments: c.polyai_resolution_comments,
    ready_to_retest: c.ready_to_retest,
    extra_fields: c.extra_fields,
    group_name: c.group_name,
    group_order: 0,
  }))
  const { data: insertedCases, error: cErr } = await supabase
    .from('uat_test_cases')
    .insert(caseRows)
    .select('id, row_number')
  if (cErr || !insertedCases) {
    return { error: cErr?.message ?? 'Case insert failed.' }
  }
  for (const c of insertedCases) insertedCaseIdByRow.set(c.row_number, c.id)

  // ------------------ Insert rounds ------------------
  const roundsToInsert = deduped.flatMap((c) => {
    const caseId = insertedCaseIdByRow.get(c.rowNumber)
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
    const { error: rErr } = await supabase
      .from('uat_test_rounds')
      .insert(roundsToInsert)
    if (rErr) return { error: `Rounds insert failed: ${rErr.message}` }
  }

  // ------------------ Column config ------------------
  const merged = mergeColumnConfig(opts.targetColumnConfig, customColumnsSeen)
  const final = await pruneEmptyCustomColumns(supabase, opts.targetUatSheetId, merged)
  const { error: cfgErr } = await supabase
    .from('uat_sheets')
    .update({ column_config: final })
    .eq('id', opts.targetUatSheetId)
  if (cfgErr) return { error: `Column config update failed: ${cfgErr.message}` }

  const warnings = [...rowWarnings]
  if (skippedEmpty > 0) warnings.unshift(`Skipped ${skippedEmpty} empty row${skippedEmpty === 1 ? '' : 's'}.`)
  if (skippedDuplicates > 0) warnings.unshift(`Skipped ${skippedDuplicates} duplicate row${skippedDuplicates === 1 ? '' : 's'}.`)

  return {
    inserted: deduped.length,
    skippedEmpty,
    skippedDuplicates,
    warnings,
    newColumnConfig: final,
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

// When creating a sibling UAT sheet for tabs 2+, give it a descriptive name
// derived from the source sheet's name and the worksheet's tab name, e.g.
// "Vixxo UAT — Outbound".
function uniqueSheetName(baseName: string, tabName: string): string {
  const cleanTab = tabName.trim()
  if (!cleanTab) return baseName
  // Avoid doubling up if the user's current sheet is literally the tab name
  if (baseName.trim().toLowerCase() === cleanTab.toLowerCase()) return baseName
  return `${baseName} — ${cleanTab}`
}

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

// Satisfy the unused import lint when we do fallbacks without using PreparedCase.
void ({} as PreparedCase)
