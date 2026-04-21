// Converts parsed rows + mappings into PreparedCase[] ready for insert.
// Handles:
//   - empty-row skipping
//   - result normalisation ("Pass" → "As Designed - Perfect" etc.)
//   - boolean normalisation for ready_to_retest
//   - splitting Round 1 vs Round 2 columns into separate round records
//   - custom columns flowing into extra_fields

import type { UATResult, UATColumn, UATColumnDataType } from '@/lib/types/database.types'
import type { ColumnMapping, ColumnValidation, GroupRow, PreparedCase, PreparedRound } from './types'

// Metadata we track for each custom column seen during an import. `validation`
// captures XLSX dropdown / checkbox rules so column_config can render the
// right editor in the table.
export interface CustomColumnMeta {
  label: string
  level: 'case' | 'round'
  validation?: ColumnValidation
}

export interface TransformOutput {
  cases: PreparedCase[]
  skippedEmpty: number
  rowWarnings: string[] // Warnings about rows we kept but couldn't fully parse
  customColumnsSeen: Map<string, CustomColumnMeta>
}

export interface TransformInput {
  // Data rows (already filtered by the parser so group-header rows are NOT
  // in here). Rows line up with `dataRowRawIndex` so we can figure out which
  // group a data row sits under.
  rows: string[][]
  // For each row in `rows`, the corresponding row index in the parser's
  // rawRows grid. Used to associate each data row with a group header.
  dataRowRawIndex: number[]
  // Group rows detected by the parser (raw-row indices + labels).
  groupRows: GroupRow[]
  mappings: ColumnMapping[]
  startingRowNumber: number
}

export function transformRows(
  inputOrRows: TransformInput | string[][],
  legacyMappings?: ColumnMapping[],
  legacyStartingRowNumber?: number,
): TransformOutput {
  // Backwards-compatible call shape — old callers passed (rows, mappings, start).
  const input: TransformInput = Array.isArray(inputOrRows)
    ? {
        rows: inputOrRows,
        dataRowRawIndex: inputOrRows.map((_, i) => i),
        groupRows: [],
        mappings: legacyMappings ?? [],
        startingRowNumber: legacyStartingRowNumber ?? 1,
      }
    : inputOrRows

  const { rows, dataRowRawIndex, groupRows, mappings, startingRowNumber } = input
  const active = mappings.filter((m) => !m.skip)
  const cases: PreparedCase[] = []
  const rowWarnings: string[] = []
  const customColumnsSeen = new Map<string, CustomColumnMeta>()
  let skippedEmpty = 0
  let nextRowNumber = startingRowNumber

  // Sort group rows by rawIndex so lookups are easy. For each data row we
  // find the most recent group row whose rawIndex is <= the row's rawIndex.
  // The banner label gets stored as `group_name` on each child so the table
  // can render a section header for it — we do NOT synthesise a parent test
  // case for the banner (that created an empty clutter row and confused
  // users who expected the merged-cell banner to be a label, not a row).
  const sortedGroups = [...groupRows].sort((a, b) => a.rowIndex - b.rowIndex)

  function groupFor(dataRawIndex: number): GroupRow | null {
    let current: GroupRow | null = null
    for (const g of sortedGroups) {
      if (g.rowIndex <= dataRawIndex) current = g
      else break
    }
    return current
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (isEmptyRow(row)) {
      skippedEmpty++
      continue
    }

    const rawIdx = dataRowRawIndex[r] ?? r
    const group = groupFor(rawIdx)

    const caseData: PreparedCase = {
      rowNumber: nextRowNumber++,
      test_label: '',
      test_script: '',
      tester_phone: '',
      polyai_resolution_comments: '',
      ready_to_retest: false,
      extra_fields: {},
      rounds: [],
      group_name: group?.name ?? null,
      parent_key: null,
      is_group_parent: false,
    }

    const roundDrafts = new Map<number, PreparedRound>()

    for (const m of active) {
      const raw = (row[m.sourceIndex] ?? '').trim()
      if (raw === '') continue

      if (m.kind === 'custom') {
        customColumnsSeen.set(m.targetKey, {
          label: m.label,
          level: m.level,
          validation: m.validation,
        })
        // Normalise booleans to "true"/"false" strings so the checkbox UI
        // round-trips cleanly. Inputs like "TRUE"/"Yes"/"1" all collapse.
        const stored =
          m.validation?.dataType === 'boolean' ? normaliseBoolString(raw) : raw
        if (m.level === 'case') {
          caseData.extra_fields[m.targetKey] = stored
        } else {
          // Custom round-level columns default to round 1 unless explicitly R2
          const roundNum = m.round ?? 1
          const draft = getOrCreateRound(roundDrafts, roundNum)
          draft.extra_fields[m.targetKey] = stored
        }
        continue
      }

      // Core fields
      if (m.level === 'case') {
        switch (m.targetKey) {
          case 'test_label':
            caseData.test_label = raw
            break
          case 'test_script':
            caseData.test_script = raw
            break
          case 'tester_phone':
            caseData.tester_phone = raw
            break
          case 'polyai_resolution_comments':
            caseData.polyai_resolution_comments = raw
            break
          case 'ready_to_retest':
            caseData.ready_to_retest = parseBoolean(raw)
            break
          default:
            // Unknown core key → treat as custom case-level to preserve the data
            caseData.extra_fields[m.targetKey] = raw
            customColumnsSeen.set(m.targetKey, {
              label: m.label,
              level: 'case',
              validation: m.validation,
            })
        }
      } else {
        const roundNum = m.round ?? 1
        const draft = getOrCreateRound(roundDrafts, roundNum)
        switch (m.targetKey) {
          case 'tester_name':
            draft.tester_name = raw
            break
          case 'call_link':
            draft.call_link = raw
            break
          case 'result': {
            const normalised = normaliseResult(raw)
            if (normalised === undefined) {
              rowWarnings.push(`Row ${rawIdx + 1}: unrecognised result "${raw}" — left blank.`)
            } else {
              draft.result = normalised
            }
            break
          }
          case 'comments':
            draft.comments = raw
            break
          default:
            draft.extra_fields[m.targetKey] = raw
            customColumnsSeen.set(m.targetKey, {
              label: m.label,
              level: 'round',
              validation: m.validation,
            })
        }
      }
    }

    // Always create Round 1 even if empty — matches existing app behaviour
    // where every test case has at least one round record to render.
    if (!roundDrafts.has(1)) {
      roundDrafts.set(1, emptyRound(1))
    }

    caseData.rounds = Array.from(roundDrafts.values()).sort(
      (a, b) => a.round_number - b.round_number,
    )
    cases.push(caseData)
  }

  return { cases, skippedEmpty, rowWarnings, customColumnsSeen }
}

function isEmptyRow(row: string[]): boolean {
  return row.every((c) => (c ?? '').trim() === '')
}

function getOrCreateRound(
  map: Map<number, PreparedRound>,
  round: number,
): PreparedRound {
  const existing = map.get(round)
  if (existing) return existing
  const fresh = emptyRound(round)
  map.set(round, fresh)
  return fresh
}

function emptyRound(round: number): PreparedRound {
  return {
    round_number: round,
    tester_name: '',
    call_link: '',
    result: null,
    comments: '',
    extra_fields: {},
  }
}

function parseBoolean(input: string): boolean {
  const v = input.toLowerCase().trim()
  return ['yes', 'y', 'true', '1', 'ready', 'x', '✓'].includes(v)
}

// Normalise a cell value that lives in a boolean-typed (TRUE/FALSE) custom
// column to the literal string "true" / "false" so the checkbox UI in the
// table can toggle it cleanly without ambiguity. Empty stays empty.
function normaliseBoolString(input: string): string {
  const v = input.toLowerCase().trim()
  if (v === '') return ''
  return parseBoolean(input) ? 'true' : 'false'
}

// Map free-text result values to the enum. Unknown strings → undefined and
// we warn upstream. Keep this list generous — UAT sheets vary a lot.
function normaliseResult(raw: string): UATResult | undefined {
  const v = raw.toLowerCase().trim()
  if (v === '') return undefined

  // Exact matches to the enum
  if (v === 'as designed - perfect') return 'As Designed - Perfect'
  if (v === 'as designed - imperfect') return 'As Designed - Imperfect'
  if (v === 'fail - good ux') return 'Fail - Good UX'
  if (v === 'fail - bad ux') return 'Fail - Bad UX'

  // Common variants
  if (v === 'perfect' || v === 'pass' || v === 'passed' || v === 'p' || v === '✓') {
    return 'As Designed - Perfect'
  }
  if (v === 'imperfect' || v === 'as designed' || v === 'pass with notes') {
    return 'As Designed - Imperfect'
  }
  if (v === 'fail good ux' || v === 'fail-good ux' || v === 'good ux fail') {
    return 'Fail - Good UX'
  }
  if (v === 'fail' || v === 'failed' || v === 'f' || v === 'fail bad ux' || v === 'bad ux fail') {
    return 'Fail - Bad UX'
  }

  return undefined
}

// Given existing column_config + the mappings we're importing, compute the
// next column_config for the sheet. Rules:
//   - Core columns are always kept in their default order.
//   - Custom columns we saw in the import with data become/stay visible.
//   - Custom columns the sheet already had stay visible too (we don't want
//     to wipe columns that have data in other cases).
// Logan's "remove empty columns" requirement is handled in a second pass
// against the cases table — see recomputeColumnConfigAfterImport in the
// action file which has DB access.
export function mergeColumnConfig(
  existing: UATColumn[],
  customsFromImport: Map<string, CustomColumnMeta>,
): UATColumn[] {
  const core = existing.filter((c) => c.kind === 'core')
  const customByKey = new Map<string, UATColumn>()
  for (const c of existing.filter((c) => c.kind === 'custom')) {
    customByKey.set(c.key, c)
  }

  let nextOrder = Math.max(...core.map((c) => c.order), -1) + 1
  for (const [key, meta] of customsFromImport) {
    const dataType: UATColumnDataType = meta.validation?.dataType ?? 'text'
    const options = meta.validation?.options

    const existingCustom = customByKey.get(key)
    if (existingCustom) {
      // Column already on the sheet — upgrade its dataType/options if the
      // import gave us richer info. Don't downgrade a list→text or lose
      // options we previously had.
      const merged: UATColumn = {
        ...existingCustom,
        dataType: existingCustom.dataType ?? dataType,
        options: existingCustom.options ?? options,
      }
      // If the new import's dataType is more specific (e.g. boolean) and the
      // existing was 'text' (the default), prefer the new one.
      if (
        (existingCustom.dataType === undefined || existingCustom.dataType === 'text') &&
        dataType !== 'text'
      ) {
        merged.dataType = dataType
        merged.options = options
      }
      customByKey.set(key, merged)
      continue
    }

    customByKey.set(key, {
      key,
      label: meta.label,
      kind: 'custom',
      level: meta.level,
      order: nextOrder++,
      dataType,
      ...(options ? { options } : {}),
    })
  }

  return [...core.sort((a, b) => a.order - b.order), ...Array.from(customByKey.values())]
}
