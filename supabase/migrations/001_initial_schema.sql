-- UAT & Hypercare Management Platform - Initial Schema
-- Step 2: Database Schema Creation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('PSM', 'AD', 'FDE', 'Client')),
  jira_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);

-- =====================================================
-- DEPLOYMENTS TABLE
-- =====================================================
CREATE TABLE public.deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  jira_space TEXT NOT NULL CHECK (jira_space IN ('HP', 'HSP', 'RL')),
  agent_designer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  forward_deployed_engineer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_deployments_client_name ON public.deployments(client_name);
CREATE INDEX idx_deployments_created_by ON public.deployments(created_by);
CREATE INDEX idx_deployments_agent_designer ON public.deployments(agent_designer_id);
CREATE INDEX idx_deployments_fde ON public.deployments(forward_deployed_engineer_id);

-- =====================================================
-- UAT SHEETS TABLE
-- =====================================================
CREATE TABLE public.uat_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deployment_id UUID NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  shareable_link_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_uat_sheets_deployment ON public.uat_sheets(deployment_id);
CREATE INDEX idx_uat_sheets_token ON public.uat_sheets(shareable_link_token);

-- =====================================================
-- UAT TEST CASES TABLE
-- =====================================================
CREATE TABLE public.uat_test_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uat_sheet_id UUID NOT NULL REFERENCES public.uat_sheets(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  test_label TEXT NOT NULL DEFAULT '',
  test_script TEXT NOT NULL DEFAULT '',
  tester_name TEXT NOT NULL DEFAULT '',
  result TEXT CHECK (result IN ('As Designed - Perfect', 'As Designed - Imperfect', 'Fail - Good UX', 'Fail - Bad UX')),
  tester_phone TEXT NOT NULL DEFAULT '',
  call_link TEXT NOT NULL DEFAULT '',
  comments_feedback TEXT NOT NULL DEFAULT '',
  ready_to_retest BOOLEAN DEFAULT FALSE NOT NULL,
  polyai_resolution_comments TEXT NOT NULL DEFAULT '',
  retester_name TEXT,
  retest_result TEXT CHECK (retest_result IN ('As Designed - Perfect', 'As Designed - Imperfect', 'Fail - Good UX', 'Fail - Bad UX')),
  retest_comments TEXT,
  retest_call_link TEXT,
  retest_feedback TEXT,
  jira_ticket_id TEXT,
  retest_jira_ticket_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_uat_test_cases_sheet ON public.uat_test_cases(uat_sheet_id);
CREATE INDEX idx_uat_test_cases_result ON public.uat_test_cases(result);
CREATE INDEX idx_uat_test_cases_ready_retest ON public.uat_test_cases(ready_to_retest);

-- Unique constraint for row numbers within a sheet
CREATE UNIQUE INDEX idx_uat_test_cases_row_number ON public.uat_test_cases(uat_sheet_id, row_number);

-- =====================================================
-- ISSUE TRACKERS TABLE
-- =====================================================
CREATE TABLE public.issue_trackers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deployment_id UUID NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  shareable_link_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_issue_trackers_deployment ON public.issue_trackers(deployment_id);
CREATE INDEX idx_issue_trackers_token ON public.issue_trackers(shareable_link_token);

-- =====================================================
-- ISSUES TABLE
-- =====================================================
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_tracker_id UUID NOT NULL REFERENCES public.issue_trackers(id) ON DELETE CASCADE,
  date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
  reported_by TEXT NOT NULL DEFAULT '',
  time_of_call TIME NOT NULL DEFAULT CURRENT_TIME,
  issue_name TEXT NOT NULL DEFAULT '',
  call_url TEXT NOT NULL DEFAULT '',
  issue_description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Backlogged', 'Resolved', 'More Info Needed', 'Non-Actionable', 'Accepted for Fix')),
  expected_fix_date DATE,
  issue_url TEXT,
  polyai_notes TEXT NOT NULL DEFAULT '',
  jira_ticket_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_issues_tracker ON public.issues(issue_tracker_id);
CREATE INDEX idx_issues_status ON public.issues(status);
CREATE INDEX idx_issues_priority ON public.issues(priority);
CREATE INDEX idx_issues_date_reported ON public.issues(date_reported);

-- =====================================================
-- PENDING JIRA TICKETS TABLE (for simulation mode)
-- =====================================================
CREATE TABLE public.pending_jira_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('UAT', 'Hypercare', 'Retest')),
  deployment_id UUID NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  related_row_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL,
  assignee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  epic_name TEXT NOT NULL,
  space TEXT NOT NULL,
  component TEXT NOT NULL,
  exported BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_pending_jira_deployment ON public.pending_jira_tickets(deployment_id);
CREATE INDEX idx_pending_jira_exported ON public.pending_jira_tickets(exported);
CREATE INDEX idx_pending_jira_type ON public.pending_jira_tickets(ticket_type);
CREATE INDEX idx_pending_jira_assignee ON public.pending_jira_tickets(assignee_id);

-- =====================================================
-- FUNCTIONS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_uat_test_cases_updated_at
  BEFORE UPDATE ON public.uat_test_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.users IS 'Team members and clients';
COMMENT ON TABLE public.deployments IS 'Client deployments with team assignments';
COMMENT ON TABLE public.uat_sheets IS 'UAT testing sheets with shareable links';
COMMENT ON TABLE public.uat_test_cases IS 'Individual test cases within UAT sheets';
COMMENT ON TABLE public.issue_trackers IS 'Hypercare issue tracking sheets';
COMMENT ON TABLE public.issues IS 'Individual issues during hypercare period';
COMMENT ON TABLE public.pending_jira_tickets IS 'JIRA tickets pending creation (simulation mode)';
