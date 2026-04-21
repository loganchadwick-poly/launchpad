// Calls Anthropic Claude to map arbitrary CSV headers → our UAT schema.
//
// Design notes:
// - We send Claude the headers AND the first few sample rows so it can
//   distinguish between, say, "Comments" (round) and "PolyAI Resolution
//   Comments" (case) when labels are ambiguous.
// - Output is a strict JSON array — we ask Claude to reply with nothing else.
// - Falls back to heuristic matching for any header the AI couldn't map.

import Anthropic from '@anthropic-ai/sdk'
import type { ColumnMapping, ColumnValidation } from './types'

const MODEL = 'claude-sonnet-4-5-20250929'
const MAX_SAMPLE_ROWS = 5

// Core target keys (these map to real columns). Any source header that
// doesn't fit one of these becomes a `kind: 'custom'` column stored in
// extra_fields.
const CORE_KEYS = {
  test_label: { level: 'case', round: null, aliases: ['test label', 'scenario', 'test case', 'test name', 'test'] },
  test_script: { level: 'case', round: null, aliases: ['test script', 'script', 'steps', 'test steps', 'procedure'] },
  tester_phone: { level: 'case', round: null, aliases: ['tester phone', 'phone', 'phone number', 'tester phone number'] },
  polyai_resolution_comments: { level: 'case', round: null, aliases: ['polyai resolution comments', 'polyai comments', 'resolution comments', 'polyai notes', 'polyai resolution'] },
  ready_to_retest: { level: 'case', round: null, aliases: ['ready to retest', 'ready to retest?', 'retest ready', 'ready for retest'] },
  // Round 1
  tester_name: { level: 'round', round: 1, aliases: ['client tester name', 'tester', 'tester name', 'tested by'] },
  call_link: { level: 'round', round: 1, aliases: ['conversation link', 'call link', 'recording', 'call url', 'conversation url'] },
  result: { level: 'round', round: 1, aliases: ['result', 'test result', 'outcome', 'pass/fail'] },
  comments: { level: 'round', round: 1, aliases: ['comments', 'comments/feedback', 'feedback', 'notes', 'tester comments'] },
  // Round 2 (retest) — same target keys, just round=2
  tester_name_r2: { level: 'round', round: 2, aliases: ['retester', 'retested by', 'retester name'] },
  call_link_r2: { level: 'round', round: 2, aliases: ['retest call link', 'retest conversation link', 'retest recording', 'retest url'] },
  result_r2: { level: 'round', round: 2, aliases: ['retest result', 'retest outcome'] },
  comments_r2: { level: 'round', round: 2, aliases: ['retest comments', 'retest feedback', 'retest notes'] },
} as const

type CoreKey = keyof typeof CORE_KEYS

interface AIMappingResponse {
  mappings: Array<{
    sourceHeader: string
    targetKey: string // one of CORE_KEYS keys, or "__custom__" for new columns
    confidence: 'high' | 'low'
  }>
}

export async function mapHeadersWithAI(
  headers: string[],
  sampleRows: string[][],
  validations: Map<number, ColumnValidation> = new Map(),
): Promise<ColumnMapping[]> {
  if (headers.length === 0) return []

  // Try AI first; fall back to pure heuristics if the API key is missing or
  // the call fails. The feature must not be blocked on AI availability.
  const apiKey = process.env.ANTHROPIC_API_KEY
  let mappings = !apiKey
    ? headers.map((h, i) => heuristicMatch(h, i))
    : await (async () => {
        try {
          const aiResponse = await callClaude(apiKey, headers, sampleRows)
          return buildMappings(headers, aiResponse)
        } catch (err) {
          console.error('[uat-import] Anthropic mapper failed, falling back to heuristic:', err)
          return headers.map((h, i) => heuristicMatch(h, i))
        }
      })()

  // Auto-assign rounds when a round-level target key appears more than once
  // (Vixxo-style: "Tester Name | Result | Comments" repeated three times for
  // rounds 1/2/3, without explicit round labels).
  mappings = inferRoundsFromRepetition(mappings)

  // Skip any columns with empty headers — trailing blank columns from the
  // XLSX show up here and shouldn't import as mystery customs.
  for (const m of mappings) {
    if (m.sourceHeader.trim() === '') m.skip = true
  }

  // Attach any XLSX data-validation rules we captured to the matching mapping.
  // Useful in two places: (1) we surface dropdown/checkbox UI in the table for
  // custom columns, and (2) we upgrade auto-slugged case-level custom columns
  // whose validation looks boolean to actually behave as checkboxes.
  for (const m of mappings) {
    const v = validations.get(m.sourceIndex)
    if (v) m.validation = v
  }
  return mappings
}

// When a round-level key shows up multiple times in the same header row,
// assume the columns form repeating round blocks. Nth occurrence → round N.
// We also downgrade *duplicate* case-level matches to custom so the data
// isn't overwritten by the last occurrence during transform.
function inferRoundsFromRepetition(mappings: ColumnMapping[]): ColumnMapping[] {
  const seenRoundIndex = new Map<string, number>() // targetKey → count of times seen
  const seenCase = new Set<string>()

  return mappings.map((m) => {
    if (m.skip || m.kind !== 'core') return m

    if (m.level === 'round') {
      // Count occurrences per (targetKey, base) so that round-1 "Result" and
      // round-2 "Retest Result" are tracked separately. Each cluster of
      // repeats then fans out into consecutive rounds:
      //   - "Tester Name" (base=1) repeating → 1, 2, 3...
      //   - "Retest Result" (base=2) repeating → 2, 3, 4... (Vixxo case)
      const base = m.round ?? 1
      const bucketKey = `${m.targetKey}@${base}`
      const n = (seenRoundIndex.get(bucketKey) ?? 0) + 1
      seenRoundIndex.set(bucketKey, n)
      const round = base + (n - 1)
      return { ...m, round }
    }

    // Case-level: if we already saw this key in the row, convert the dupe
    // into a custom column so the repeat doesn't clobber the first copy.
    if (seenCase.has(m.targetKey)) {
      return {
        ...m,
        targetKey: slugify(`${m.targetKey}_${m.sourceIndex}`),
        label: m.sourceHeader.trim() || m.label,
        kind: 'custom',
        level: 'case',
        round: null,
      }
    }
    seenCase.add(m.targetKey)
    return m
  })
}

async function callClaude(
  apiKey: string,
  headers: string[],
  sampleRows: string[][],
): Promise<AIMappingResponse> {
  const client = new Anthropic({ apiKey })

  const coreKeyList = Object.entries(CORE_KEYS)
    .map(([key, spec]) => `  - "${key}" (level=${spec.level}${spec.round ? `, round=${spec.round}` : ''}) — aliases: ${spec.aliases.join(', ')}`)
    .join('\n')

  const sampleTable = sampleRows
    .slice(0, MAX_SAMPLE_ROWS)
    .map((row) => row.map((c) => (c.length > 60 ? c.slice(0, 57) + '...' : c)).join(' | '))
    .join('\n')

  const prompt = `You are mapping column headers from an uploaded UAT test case spreadsheet to a fixed schema.

HEADERS:
${headers.map((h, i) => `  ${i}: "${h}"`).join('\n')}

SAMPLE ROWS (first ${Math.min(MAX_SAMPLE_ROWS, sampleRows.length)}):
${sampleTable}

TARGET SCHEMA KEYS:
${coreKeyList}

RULES:
- Map each header to the BEST matching targetKey, or to "__custom__" if none fits.
- Rounds: "Client Tester Name" → tester_name (round 1). "Retester" → tester_name_r2 (round 2). Same split for call_link / result / comments.
- "Comments" alone is round-level (tester's feedback on that specific test). "PolyAI Resolution Comments" is case-level.
- Use "high" confidence for exact/near-exact matches, "low" for fuzzy guesses or anything unexpected.
- Use "__custom__" for fields like "API Data", "Environment", "Priority", etc. that don't fit the core schema.
- Return ONLY a JSON object, no prose.

Return this exact JSON shape:
{
  "mappings": [
    { "sourceHeader": "<exact header>", "targetKey": "<key or __custom__>", "confidence": "high" | "low" }
  ]
}`

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  // Be lenient about code fences Claude sometimes adds despite "no prose".
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(jsonText) as AIMappingResponse
  if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
    throw new Error('AI response missing mappings array')
  }
  return parsed
}

function buildMappings(
  headers: string[],
  ai: AIMappingResponse,
): ColumnMapping[] {
  // Index AI results by sourceHeader for fast lookup.
  const aiByHeader = new Map<string, { targetKey: string; confidence: 'high' | 'low' }>()
  for (const m of ai.mappings) {
    aiByHeader.set(m.sourceHeader, { targetKey: m.targetKey, confidence: m.confidence })
  }

  return headers.map((header, index) => {
    const ai = aiByHeader.get(header)
    if (!ai) return heuristicMatch(header, index)

    if (ai.targetKey === '__custom__' || !(ai.targetKey in CORE_KEYS)) {
      return customMapping(header, index, ai.confidence)
    }

    const spec = CORE_KEYS[ai.targetKey as CoreKey]
    return {
      sourceHeader: header,
      sourceIndex: index,
      targetKey: stripR2Suffix(ai.targetKey as CoreKey),
      label: canonicalLabel(ai.targetKey as CoreKey, header),
      kind: 'core',
      level: spec.level as 'case' | 'round',
      round: spec.round,
      confidence: ai.confidence,
      skip: false,
    }
  })
}

// Heuristic fallback — normalise + alias match.
function heuristicMatch(header: string, index: number): ColumnMapping {
  const norm = header.toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').trim()
  for (const [key, spec] of Object.entries(CORE_KEYS) as Array<[CoreKey, typeof CORE_KEYS[CoreKey]]>) {
    if (spec.aliases.some((a) => a.toLowerCase() === norm)) {
      return {
        sourceHeader: header,
        sourceIndex: index,
        targetKey: stripR2Suffix(key),
        label: canonicalLabel(key, header),
        kind: 'core',
        level: spec.level as 'case' | 'round',
        round: spec.round,
        confidence: 'high',
        skip: false,
      }
    }
  }
  return customMapping(header, index, 'low')
}

function customMapping(header: string, index: number, confidence: 'high' | 'low'): ColumnMapping {
  return {
    sourceHeader: header,
    sourceIndex: index,
    targetKey: slugify(header),
    label: header.trim(),
    kind: 'custom',
    level: 'case', // Default custom columns to case-level; user can adjust if needed
    round: null,
    confidence,
    skip: false,
  }
}

// Strip the "_r2" suffix so round-2 variants collapse to the same target key
// (e.g. "tester_name_r2" → "tester_name"). The round number on the mapping
// is what tells us where the value lands at insert time.
function stripR2Suffix(key: CoreKey): string {
  return key.endsWith('_r2') ? key.slice(0, -3) : key
}

function canonicalLabel(key: CoreKey, fallback: string): string {
  const canonical: Record<CoreKey, string> = {
    test_label: 'Test Label',
    test_script: 'Test Script',
    tester_phone: 'Tester Phone Number',
    polyai_resolution_comments: 'PolyAI Resolution Comments',
    ready_to_retest: 'Ready to Retest?',
    tester_name: 'Client Tester Name',
    call_link: 'Conversation Link',
    result: 'Result',
    comments: 'Comments',
    tester_name_r2: 'Retester',
    call_link_r2: 'Retest Call Link',
    result_r2: 'Retest Result',
    comments_r2: 'Retest Comments',
  }
  return canonical[key] ?? fallback
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'custom'
  )
}
