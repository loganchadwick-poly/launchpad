-- CSV/XLSX Import Support for UAT Test Cases
-- Adds flexible per-sheet schema so imports can add custom columns (e.g. "API Data")
-- and remove unused ones, without touching the core table schema.

-- =====================================================
-- 1. column_config on uat_sheets
-- =====================================================
-- Array of { key, label, kind: 'core'|'custom', level: 'case'|'round', order }
-- - "core" columns map to real columns on uat_test_cases / uat_test_rounds
-- - "custom" columns live in the extra_fields JSONB on the matching row
-- - Render order is driven by the `order` field (stable across re-imports)
ALTER TABLE public.uat_sheets
  ADD COLUMN column_config JSONB NOT NULL DEFAULT '[
    {"key":"test_label","label":"Test Label","kind":"core","level":"case","order":0},
    {"key":"test_script","label":"Test Script","kind":"core","level":"case","order":1},
    {"key":"tester_name","label":"Client Tester Name","kind":"core","level":"round","order":2},
    {"key":"tester_phone","label":"Tester Phone Number","kind":"core","level":"case","order":3},
    {"key":"call_link","label":"Conversation Link","kind":"core","level":"round","order":4},
    {"key":"result","label":"Result","kind":"core","level":"round","order":5},
    {"key":"comments","label":"Comments","kind":"core","level":"round","order":6},
    {"key":"polyai_resolution_comments","label":"PolyAI Resolution Comments","kind":"core","level":"case","order":7},
    {"key":"ready_to_retest","label":"Ready to Retest?","kind":"core","level":"case","order":8}
  ]'::jsonb;

COMMENT ON COLUMN public.uat_sheets.column_config IS
  'Ordered list of columns this sheet renders. Core columns map to real schema; custom columns land in extra_fields JSONB on the case or round.';

-- =====================================================
-- 2. extra_fields on uat_test_cases
-- =====================================================
-- Per-case custom columns: { "api_data": "...", "custom_xyz": "..." }
ALTER TABLE public.uat_test_cases
  ADD COLUMN extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.uat_test_cases.extra_fields IS
  'Custom case-level columns not in the core schema, keyed by column_config.key.';

-- =====================================================
-- 3. extra_fields on uat_test_rounds
-- =====================================================
-- Per-round custom columns (e.g. per-round notes specific to a client's sheet)
ALTER TABLE public.uat_test_rounds
  ADD COLUMN extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.uat_test_rounds.extra_fields IS
  'Custom round-level columns not in the core schema, keyed by column_config.key.';

-- =====================================================
-- 4. Backfill existing sheets with the default config
-- =====================================================
-- The DEFAULT clause only fires on rows inserted after migration runs.
-- Existing sheets were created with NULL/missing -- force them to the baseline
-- so the UI renders unchanged. (NOT NULL + DEFAULT already back-filled to the
-- default literal in Postgres 11+, but this makes the intent explicit and
-- idempotent in case anything was manually edited.)
UPDATE public.uat_sheets
SET column_config = '[
    {"key":"test_label","label":"Test Label","kind":"core","level":"case","order":0},
    {"key":"test_script","label":"Test Script","kind":"core","level":"case","order":1},
    {"key":"tester_name","label":"Client Tester Name","kind":"core","level":"round","order":2},
    {"key":"tester_phone","label":"Tester Phone Number","kind":"core","level":"case","order":3},
    {"key":"call_link","label":"Conversation Link","kind":"core","level":"round","order":4},
    {"key":"result","label":"Result","kind":"core","level":"round","order":5},
    {"key":"comments","label":"Comments","kind":"core","level":"round","order":6},
    {"key":"polyai_resolution_comments","label":"PolyAI Resolution Comments","kind":"core","level":"case","order":7},
    {"key":"ready_to_retest","label":"Ready to Retest?","kind":"core","level":"case","order":8}
  ]'::jsonb
WHERE column_config IS NULL
   OR jsonb_array_length(column_config) = 0;

-- =====================================================
-- 5. Indexes
-- =====================================================
-- GIN index lets us query "which sheets have a custom column named X"
CREATE INDEX IF NOT EXISTS idx_uat_sheets_column_config ON public.uat_sheets USING GIN (column_config);
CREATE INDEX IF NOT EXISTS idx_uat_test_cases_extra_fields ON public.uat_test_cases USING GIN (extra_fields);
CREATE INDEX IF NOT EXISTS idx_uat_test_rounds_extra_fields ON public.uat_test_rounds USING GIN (extra_fields);
