-- UAT Test Rounds - Support for multiple testing rounds per test case
-- This migration creates a new table to track each round of testing

-- =====================================================
-- CREATE TEST ROUNDS TABLE
-- =====================================================
CREATE TABLE public.uat_test_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_case_id UUID NOT NULL REFERENCES public.uat_test_cases(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  tester_name TEXT NOT NULL DEFAULT '',
  call_link TEXT NOT NULL DEFAULT '',
  result TEXT CHECK (result IN ('As Designed - Perfect', 'As Designed - Imperfect', 'Fail - Good UX', 'Fail - Bad UX')),
  comments TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(test_case_id, round_number)
);

-- Indexes for performance
CREATE INDEX idx_test_rounds_test_case ON public.uat_test_rounds(test_case_id);
CREATE INDEX idx_test_rounds_round_number ON public.uat_test_rounds(round_number);
CREATE INDEX idx_test_rounds_result ON public.uat_test_rounds(result);

-- =====================================================
-- MIGRATE EXISTING DATA TO ROUNDS
-- =====================================================

-- Create Round 1 from existing test case data (where there's a result)
INSERT INTO public.uat_test_rounds (test_case_id, round_number, tester_name, call_link, result, comments, created_at)
SELECT 
  id,
  1,
  COALESCE(tester_name, ''),
  COALESCE(call_link, ''),
  result,
  COALESCE(comments_feedback, ''),
  created_at
FROM public.uat_test_cases
WHERE result IS NOT NULL;

-- Create Round 2 from existing retest data (where there's a retest_result)
INSERT INTO public.uat_test_rounds (test_case_id, round_number, tester_name, call_link, result, comments, created_at)
SELECT 
  id,
  2,
  COALESCE(retester_name, ''),
  COALESCE(retest_call_link, ''),
  retest_result,
  COALESCE(retest_comments, ''),
  updated_at
FROM public.uat_test_cases
WHERE retest_result IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.uat_test_rounds ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all rounds
CREATE POLICY "Allow authenticated read access to test rounds"
  ON public.uat_test_rounds FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert rounds
CREATE POLICY "Allow authenticated insert access to test rounds"
  ON public.uat_test_rounds FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update rounds
CREATE POLICY "Allow authenticated update access to test rounds"
  ON public.uat_test_rounds FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete rounds
CREATE POLICY "Allow authenticated delete access to test rounds"
  ON public.uat_test_rounds FOR DELETE
  TO authenticated
  USING (true);

-- Allow public access for shareable links (clients)
CREATE POLICY "Allow public read access to test rounds"
  ON public.uat_test_rounds FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to test rounds"
  ON public.uat_test_rounds FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access to test rounds"
  ON public.uat_test_rounds FOR UPDATE
  TO anon
  USING (true);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.uat_test_rounds IS 'Individual testing rounds for each test case - supports unlimited retests';
COMMENT ON COLUMN public.uat_test_rounds.round_number IS '1 = initial test, 2+ = retests';
COMMENT ON COLUMN public.uat_test_rounds.result IS 'Test result for this round';

-- Note: Old columns in uat_test_cases are kept for backwards compatibility
-- They can be dropped in a future migration once the app is fully migrated:
-- ALTER TABLE public.uat_test_cases DROP COLUMN tester_name, result, call_link, etc.
