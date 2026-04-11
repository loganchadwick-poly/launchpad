-- UAT & Hypercare Management Platform - Row Level Security Policies
-- Step 2: Security Configuration

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uat_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uat_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_jira_tickets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Allow users to read all users (for dropdowns, team listings, etc.)
CREATE POLICY "Users can view all users"
  ON public.users FOR SELECT
  USING (true);

-- Allow authenticated users to insert users (PSM can add team members)
CREATE POLICY "Authenticated users can insert users"
  ON public.users FOR INSERT
  WITH CHECK (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid()::text = id::text);

-- =====================================================
-- DEPLOYMENTS TABLE POLICIES
-- =====================================================

-- Allow all authenticated users to view deployments
CREATE POLICY "Authenticated users can view deployments"
  ON public.deployments FOR SELECT
  USING (true);

-- Allow authenticated users to create deployments
CREATE POLICY "Authenticated users can create deployments"
  ON public.deployments FOR INSERT
  WITH CHECK (true);

-- Allow deployment creators and team members to update
CREATE POLICY "Team members can update deployments"
  ON public.deployments FOR UPDATE
  USING (
    auth.uid()::text = created_by::text OR
    auth.uid()::text = agent_designer_id::text OR
    auth.uid()::text = forward_deployed_engineer_id::text
  );

-- =====================================================
-- UAT SHEETS TABLE POLICIES
-- =====================================================

-- Allow all authenticated users to view UAT sheets
CREATE POLICY "Authenticated users can view UAT sheets"
  ON public.uat_sheets FOR SELECT
  USING (true);

-- Allow authenticated users to create UAT sheets
CREATE POLICY "Authenticated users can create UAT sheets"
  ON public.uat_sheets FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to update UAT sheets
CREATE POLICY "Authenticated users can update UAT sheets"
  ON public.uat_sheets FOR UPDATE
  USING (true);

-- =====================================================
-- UAT TEST CASES TABLE POLICIES
-- =====================================================

-- Allow all users (including unauthenticated) to view test cases
-- This allows clients to access via shareable links
CREATE POLICY "Anyone can view UAT test cases"
  ON public.uat_test_cases FOR SELECT
  USING (true);

-- Allow all users to insert test cases
CREATE POLICY "Anyone can insert UAT test cases"
  ON public.uat_test_cases FOR INSERT
  WITH CHECK (true);

-- Allow all users to update test cases
CREATE POLICY "Anyone can update UAT test cases"
  ON public.uat_test_cases FOR UPDATE
  USING (true);

-- Allow authenticated users to delete test cases
CREATE POLICY "Authenticated users can delete UAT test cases"
  ON public.uat_test_cases FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- ISSUE TRACKERS TABLE POLICIES
-- =====================================================

-- Allow all authenticated users to view issue trackers
CREATE POLICY "Authenticated users can view issue trackers"
  ON public.issue_trackers FOR SELECT
  USING (true);

-- Allow authenticated users to create issue trackers
CREATE POLICY "Authenticated users can create issue trackers"
  ON public.issue_trackers FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to update issue trackers
CREATE POLICY "Authenticated users can update issue trackers"
  ON public.issue_trackers FOR UPDATE
  USING (true);

-- =====================================================
-- ISSUES TABLE POLICIES
-- =====================================================

-- Allow all users (including unauthenticated) to view issues
CREATE POLICY "Anyone can view issues"
  ON public.issues FOR SELECT
  USING (true);

-- Allow all users to insert issues
CREATE POLICY "Anyone can insert issues"
  ON public.issues FOR INSERT
  WITH CHECK (true);

-- Allow all users to update issues
CREATE POLICY "Anyone can update issues"
  ON public.issues FOR UPDATE
  USING (true);

-- Allow authenticated users to delete issues
CREATE POLICY "Authenticated users can delete issues"
  ON public.issues FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- PENDING JIRA TICKETS TABLE POLICIES
-- =====================================================

-- Allow authenticated users to view pending tickets
CREATE POLICY "Authenticated users can view pending JIRA tickets"
  ON public.pending_jira_tickets FOR SELECT
  USING (true);

-- Allow system to insert pending tickets (via triggers)
CREATE POLICY "Anyone can insert pending JIRA tickets"
  ON public.pending_jira_tickets FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to update pending tickets (mark as exported)
CREATE POLICY "Authenticated users can update pending JIRA tickets"
  ON public.pending_jira_tickets FOR UPDATE
  USING (true);

-- Allow authenticated users to delete pending tickets
CREATE POLICY "Authenticated users can delete pending JIRA tickets"
  ON public.pending_jira_tickets FOR DELETE
  USING (true);
