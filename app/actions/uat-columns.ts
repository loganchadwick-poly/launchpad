'use server'

// Server actions for managing custom columns on a UAT sheet.
//
// Columns live in `uat_sheets.column_config` as a JSONB array of UATColumn.
// Custom columns additionally carry data in `extra_fields` on either
// `uat_test_cases` (when level='case') or `uat_test_rounds` (when level='round').
// Deleting a column optionally strips that key from every row's extra_fields.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/getUser'
import type { UATColumn, UATColumnDataType, UATColumnLevel } from '@/lib/types/database.types'

export interface AddColumnInput {
  uatSheetId: string
  label: string
  level: UATColumnLevel
  dataType: UATColumnDataType
  options?: string[] // only used when dataType === 'list'
}

export interface UpdateColumnInput {
  uatSheetId: string
  key: string
  label?: string
  dataType?: UATColumnDataType
  options?: string[]
}

export interface DeleteColumnInput {
  uatSheetId: string
  key: string
  // If true, also strip this key from every row's extra_fields. If false,
  // the column disappears from the table but the data stays in the DB so
  // re-adding the column brings the values back.
  stripData?: boolean
}

export async function addColumn(input: AddColumnInput): Promise<
  | { success: true; column: UATColumn }
  | { success: false; error: string }
> {
  try {
    await requireAuth()
    const label = (input.label ?? '').trim()
    if (!label) return { success: false, error: 'Column name is required.' }
    if (label.length > 80) {
      return { success: false, error: 'Column name is too long (80 chars max).' }
    }
    if (input.dataType === 'list') {
      const opts = sanitiseOptions(input.options)
      if (opts.length === 0) {
        return { success: false, error: 'Dropdown columns need at least one option.' }
      }
    }

    const supabase = await createClient()
    const sheet = await loadSheet(supabase, input.uatSheetId)
    if ('error' in sheet) return { success: false, error: sheet.error }

    const existing = sheet.column_config
    const key = uniqueKey(label, existing.map((c) => c.key))
    const nextOrder = Math.max(-1, ...existing.map((c) => c.order)) + 1

    const column: UATColumn = {
      key,
      label,
      kind: 'custom',
      level: input.level,
      order: nextOrder,
      dataType: input.dataType,
      ...(input.dataType === 'list'
        ? { options: sanitiseOptions(input.options) }
        : {}),
    }

    const nextConfig = [...existing, column]
    const { error } = await supabase
      .from('uat_sheets')
      .update({ column_config: nextConfig })
      .eq('id', input.uatSheetId)
    if (error) return { success: false, error: error.message }

    revalidatePath(`/uat-sheets/${input.uatSheetId}`)
    return { success: true, column }
  } catch (err) {
    return { success: false, error: errMessage(err) }
  }
}

export async function updateColumn(input: UpdateColumnInput): Promise<
  | { success: true; column: UATColumn }
  | { success: false; error: string }
> {
  try {
    await requireAuth()
    const supabase = await createClient()
    const sheet = await loadSheet(supabase, input.uatSheetId)
    if ('error' in sheet) return { success: false, error: sheet.error }

    const existing = sheet.column_config
    const idx = existing.findIndex((c) => c.key === input.key)
    if (idx === -1) return { success: false, error: 'Column not found.' }
    const current = existing[idx]
    if (current.kind === 'core') {
      return { success: false, error: 'Core columns cannot be edited.' }
    }

    const label =
      input.label !== undefined ? input.label.trim() : current.label
    if (!label) return { success: false, error: 'Column name is required.' }

    const dataType = input.dataType ?? current.dataType ?? 'text'
    let options = input.options !== undefined ? sanitiseOptions(input.options) : current.options
    if (dataType === 'list') {
      if (!options || options.length === 0) {
        return { success: false, error: 'Dropdown columns need at least one option.' }
      }
    } else {
      // Non-list columns don't carry options.
      options = undefined
    }

    const merged: UATColumn = {
      ...current,
      label,
      dataType,
      ...(options ? { options } : {}),
    }
    if (!options) delete (merged as { options?: string[] }).options

    const nextConfig = [...existing]
    nextConfig[idx] = merged

    const { error } = await supabase
      .from('uat_sheets')
      .update({ column_config: nextConfig })
      .eq('id', input.uatSheetId)
    if (error) return { success: false, error: error.message }

    revalidatePath(`/uat-sheets/${input.uatSheetId}`)
    return { success: true, column: merged }
  } catch (err) {
    return { success: false, error: errMessage(err) }
  }
}

export async function deleteColumn(input: DeleteColumnInput): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  try {
    await requireAuth()
    const supabase = await createClient()
    const sheet = await loadSheet(supabase, input.uatSheetId)
    if ('error' in sheet) return { success: false, error: sheet.error }

    const existing = sheet.column_config
    const target = existing.find((c) => c.key === input.key)
    if (!target) return { success: false, error: 'Column not found.' }
    if (target.kind === 'core') {
      return { success: false, error: 'Core columns cannot be deleted.' }
    }

    const nextConfig = existing.filter((c) => c.key !== input.key)
    const { error } = await supabase
      .from('uat_sheets')
      .update({ column_config: nextConfig })
      .eq('id', input.uatSheetId)
    if (error) return { success: false, error: error.message }

    if (input.stripData) {
      await stripExtraFieldKey(supabase, input.uatSheetId, input.key, target.level)
    }

    revalidatePath(`/uat-sheets/${input.uatSheetId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: errMessage(err) }
  }
}

// =====================================================
// Helpers
// =====================================================

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function loadSheet(
  supabase: SupabaseClient,
  uatSheetId: string,
): Promise<{ column_config: UATColumn[] } | { error: string }> {
  const { data, error } = await supabase
    .from('uat_sheets')
    .select('column_config')
    .eq('id', uatSheetId)
    .single()
  if (error || !data) return { error: error?.message ?? 'UAT sheet not found.' }
  return { column_config: (data.column_config as UATColumn[]) ?? [] }
}

// Walk every extra_fields blob on the sheet, drop the given key, write back
// only rows whose blob actually changed. Level picks the right table.
async function stripExtraFieldKey(
  supabase: SupabaseClient,
  uatSheetId: string,
  key: string,
  level: UATColumnLevel,
) {
  if (level === 'case') {
    const { data } = await supabase
      .from('uat_test_cases')
      .select('id, extra_fields')
      .eq('uat_sheet_id', uatSheetId)
    for (const row of data ?? []) {
      const ef = (row.extra_fields ?? {}) as Record<string, string>
      if (key in ef) {
        const next = { ...ef }
        delete next[key]
        await supabase
          .from('uat_test_cases')
          .update({ extra_fields: next })
          .eq('id', row.id)
      }
    }
  } else {
    const { data } = await supabase
      .from('uat_test_rounds')
      .select('id, extra_fields, test_case_id, uat_test_cases!inner(uat_sheet_id)')
      .eq('uat_test_cases.uat_sheet_id', uatSheetId)
    for (const row of data ?? []) {
      const ef = (row.extra_fields ?? {}) as Record<string, string>
      if (key in ef) {
        const next = { ...ef }
        delete next[key]
        await supabase
          .from('uat_test_rounds')
          .update({ extra_fields: next })
          .eq('id', row.id)
      }
    }
  }
}

function sanitiseOptions(options: string[] | undefined): string[] {
  if (!options) return []
  const cleaned: string[] = []
  const seen = new Set<string>()
  for (const opt of options) {
    const v = (opt ?? '').trim()
    if (!v) continue
    if (seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    cleaned.push(v)
  }
  return cleaned
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'column'
  )
}

function uniqueKey(label: string, taken: string[]): string {
  const base = slugify(label)
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}_${n}`)) n++
  return `${base}_${n}`
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error.'
}
