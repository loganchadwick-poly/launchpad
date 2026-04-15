-- UAT & Hypercare Management Platform
-- Migration 011: Replace deployment_id + jira_space with jira_component, Rename PSM to DS
--
-- Changes:
-- 1. Add jira_component column to deployments, migrate data, drop old columns
-- 2. Rename role 'PSM' to 'DS' (Deployment Strategist) in users table
-- 3. Recreate all PL/pgSQL functions that referenced old columns

-- =====================================================
-- 1A. REPLACE deployment_id + jira_space WITH jira_component
-- =====================================================

-- Add new column
ALTER TABLE public.deployments ADD COLUMN jira_component TEXT;

-- Migrate existing data (use deployment_id as the initial value)
UPDATE public.deployments SET jira_component = deployment_id;

-- Make NOT NULL after backfill
ALTER TABLE public.deployments ALTER COLUMN jira_component SET NOT NULL;

-- Drop old columns (CHECK constraint on jira_space is dropped automatically)
ALTER TABLE public.deployments DROP COLUMN deployment_id;
ALTER TABLE public.deployments DROP COLUMN jira_space;

-- =====================================================
-- 1B. RENAME PSM ROLE TO DS
-- =====================================================

-- Drop existing CHECK constraint FIRST (old constraint rejects 'DS')
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Migrate existing PSM users to DS
UPDATE public.users SET role = 'DS' WHERE role = 'PSM';

-- Add new constraint with DS instead of PSM
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('DS', 'AD', 'FDE', 'Client'));

-- =====================================================
-- 1C. DROP SUPERSEDED FUNCTIONS (triggers already removed)
-- =====================================================

DROP FUNCTION IF EXISTS create_jira_ticket_for_uat() CASCADE;
DROP FUNCTION IF EXISTS create_jira_ticket_for_retest() CASCADE;

-- Drop build_ticket_description (no longer called, references old columns)
DROP FUNCTION IF EXISTS build_ticket_description(RECORD, RECORD, RECORD, RECORD) CASCADE;

-- =====================================================
-- 1D. RECREATE FUNCTIONS: create_jira_ticket_for_test_round()
-- (Originally from migration 010, updated for jira_component)
-- =====================================================

CREATE OR REPLACE FUNCTION create_jira_ticket_for_test_round()
RETURNS TRIGGER AS $$
DECLARE
  v_test_case RECORD;
  v_uat_sheet RECORD;
  v_deployment RECORD;
  v_ticket_summary TEXT;
  v_ticket_description TEXT;
  v_epic_name TEXT;
  v_ticket_type TEXT;
  v_existing_ticket_count INT;
  v_child_info TEXT;
  v_child RECORD;
  v_child_count INT;
BEGIN
  IF NEW.result IS NOT NULL
     AND NEW.result != 'As Designed - Perfect'
     AND (OLD.result IS NULL OR OLD.result = 'As Designed - Perfect' OR OLD.result != NEW.result) THEN

    SELECT * INTO v_test_case FROM public.uat_test_cases WHERE id = NEW.test_case_id;

    IF v_test_case.test_label IS NULL OR v_test_case.test_label = '' THEN
      RETURN NEW;
    END IF;

    IF v_test_case.parent_row_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_uat_sheet FROM public.uat_sheets WHERE id = v_test_case.uat_sheet_id;

    SELECT
      d.*,
      u.name as assignee_name,
      u.jira_username as assignee_jira
    INTO v_deployment
    FROM public.deployments d
    LEFT JOIN public.users u ON u.id = d.agent_designer_id
    WHERE d.id = v_uat_sheet.deployment_id;

    SELECT COUNT(*) INTO v_existing_ticket_count
    FROM public.pending_jira_tickets
    WHERE related_row_id = NEW.id::text
      AND exported = false;

    IF v_existing_ticket_count > 0 THEN
      RETURN NEW;
    END IF;

    IF NEW.round_number = 1 THEN
      v_ticket_type := 'UAT';
    ELSE
      v_ticket_type := 'Retest';
    END IF;

    SELECT COUNT(*) INTO v_child_count
    FROM public.uat_test_cases
    WHERE parent_row_id = v_test_case.id;

    IF v_child_count > 0 THEN
      v_ticket_summary := COALESCE(v_test_case.group_name, v_test_case.test_label) || ' (' || (v_child_count + 1) || ' issues)';
    ELSIF NEW.round_number = 1 THEN
      v_ticket_summary := v_test_case.test_label || ' - [Row ' || v_test_case.row_number || ']';
    ELSE
      v_ticket_summary := v_test_case.test_label || ' (Retest R' || NEW.round_number || ') - [Row ' || v_test_case.row_number || ']';
    END IF;

    v_ticket_description := E'**Test Case:** ' || v_test_case.test_label || E'\n' ||
                           E'**Test Script:**\n' || COALESCE(v_test_case.test_script, 'N/A') || E'\n\n' ||
                           E'**Round:** ' || NEW.round_number || E'\n' ||
                           E'**Result:** ' || NEW.result || E'\n' ||
                           E'**Tester:** ' || COALESCE(NEW.tester_name, 'Not specified') || E'\n' ||
                           E'**Call Recording:** ' || COALESCE(NEW.call_link, 'Not provided') || E'\n\n' ||
                           E'**Tester Feedback:**\n' || COALESCE(NEW.comments, 'No feedback provided') || E'\n\n';

    IF v_child_count > 0 THEN
      v_ticket_description := v_ticket_description || E'---\n\n**Related Issues in Group:**\n\n';

      FOR v_child IN
        SELECT tc.*, tr.result as latest_result, tr.comments as latest_comments, tr.tester_name as latest_tester
        FROM public.uat_test_cases tc
        LEFT JOIN LATERAL (
          SELECT * FROM public.uat_test_rounds
          WHERE test_case_id = tc.id
          ORDER BY round_number DESC
          LIMIT 1
        ) tr ON true
        WHERE tc.parent_row_id = v_test_case.id
        ORDER BY tc.group_order
      LOOP
        v_ticket_description := v_ticket_description ||
          E'**Row ' || v_child.row_number || ': ' || COALESCE(v_child.test_label, 'Untitled') || E'**\n' ||
          E'Result: ' || COALESCE(v_child.latest_result, 'Not tested') || E'\n' ||
          E'Feedback: ' || COALESCE(v_child.latest_comments, 'No feedback') || E'\n\n';
      END LOOP;
    END IF;

    v_ticket_description := v_ticket_description ||
                           E'---\n' ||
                           E'**Deployment:** ' || v_deployment.client_name || ' (' || v_deployment.jira_component || ')' || E'\n' ||
                           E'**UAT Sheet:** ' || v_uat_sheet.name;

    v_epic_name := '[' || v_deployment.client_name || '] UAT';

    INSERT INTO public.pending_jira_tickets (
      ticket_type,
      deployment_id,
      related_row_id,
      summary,
      description,
      priority,
      assignee_id,
      epic_name,
      space,
      component
    ) VALUES (
      v_ticket_type,
      v_deployment.id,
      NEW.id::text,
      v_ticket_summary,
      v_ticket_description,
      CASE
        WHEN NEW.result = 'Fail - Bad UX' THEN 'High'
        WHEN NEW.result = 'Fail - Good UX' THEN 'Medium'
        ELSE 'Low'
      END,
      v_deployment.agent_designer_id,
      v_epic_name,
      v_deployment.jira_component,
      v_deployment.client_name
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 1E. RECREATE FUNCTION: create_jira_ticket_for_issue()
-- (Originally from migration 010, updated for jira_component)
-- =====================================================

CREATE OR REPLACE FUNCTION create_jira_ticket_for_issue()
RETURNS TRIGGER AS $$
DECLARE
  v_deployment RECORD;
  v_issue_tracker RECORD;
  v_ticket_summary TEXT;
  v_ticket_description TEXT;
  v_epic_name TEXT;
  v_existing_ticket_count INT;
  v_child_count INT;
  v_child RECORD;
BEGIN
  IF NEW.jira_ticket_id IS NULL THEN

    IF NEW.parent_issue_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_existing_ticket_count
    FROM public.pending_jira_tickets
    WHERE related_row_id = NEW.id::text
      AND exported = false;

    IF v_existing_ticket_count > 0 THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_issue_tracker FROM public.issue_trackers WHERE id = NEW.issue_tracker_id;

    SELECT d.* INTO v_deployment
    FROM public.deployments d
    WHERE d.id = v_issue_tracker.deployment_id;

    SELECT COUNT(*) INTO v_child_count
    FROM public.issues
    WHERE parent_issue_id = NEW.id;

    IF v_child_count > 0 THEN
      v_ticket_summary := COALESCE(NEW.group_name, NEW.issue_name) || ' (' || (v_child_count + 1) || ' issues)';
    ELSE
      v_ticket_summary := NEW.issue_name;
    END IF;

    v_ticket_description := E'**Issue:** ' || NEW.issue_name || E'\n\n' ||
                           E'**Description:**\n' || NEW.issue_description || E'\n\n' ||
                           E'**Reported By:** ' || NEW.reported_by || E'\n' ||
                           E'**Date Reported:** ' || NEW.date_reported || E'\n' ||
                           E'**Time of Call:** ' || NEW.time_of_call || E'\n' ||
                           E'**Priority:** ' || NEW.priority || E'\n' ||
                           E'**Call Recording:** ' || COALESCE(NEW.call_url, 'Not provided') || E'\n\n';

    IF v_child_count > 0 THEN
      v_ticket_description := v_ticket_description || E'---\n\n**Related Issues in Group:**\n\n';

      FOR v_child IN
        SELECT * FROM public.issues
        WHERE parent_issue_id = NEW.id
        ORDER BY group_order
      LOOP
        v_ticket_description := v_ticket_description ||
          E'**' || v_child.issue_name || E'**\n' ||
          E'Priority: ' || v_child.priority || E'\n' ||
          E'Description: ' || COALESCE(v_child.issue_description, 'No description') || E'\n\n';
      END LOOP;
    END IF;

    v_ticket_description := v_ticket_description ||
                           E'---\n' ||
                           E'**Deployment:** ' || v_deployment.client_name || ' (' || v_deployment.jira_component || ')' || E'\n' ||
                           E'**Issue Tracker:** ' || v_issue_tracker.name;

    v_epic_name := '[' || v_deployment.client_name || '] Hypercare';

    INSERT INTO public.pending_jira_tickets (
      ticket_type,
      deployment_id,
      related_row_id,
      summary,
      description,
      priority,
      assignee_id,
      epic_name,
      space,
      component
    ) VALUES (
      'Hypercare',
      v_deployment.id,
      NEW.id::text,
      v_ticket_summary,
      v_ticket_description,
      NEW.priority,
      v_deployment.forward_deployed_engineer_id,
      v_epic_name,
      v_deployment.jira_component,
      v_deployment.client_name
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 1F. RECREATE FUNCTION: create_or_update_jira_ticket_for_test_round()
-- (Originally from migration 007, updated for jira_component)
-- =====================================================

CREATE OR REPLACE FUNCTION create_or_update_jira_ticket_for_test_round()
RETURNS TRIGGER AS $$
DECLARE
  v_test_case RECORD;
  v_uat_sheet RECORD;
  v_deployment RECORD;
  v_ticket_summary TEXT;
  v_ticket_description TEXT;
  v_epic_name TEXT;
  v_ticket_type TEXT;
  v_existing_ticket RECORD;
  v_new_priority TEXT;
  v_log_change_type TEXT;
  v_log_old_value TEXT;
  v_log_new_value TEXT;
BEGIN
  IF NEW.result IS NULL OR NEW.result = 'As Designed - Perfect' THEN
    RETURN NEW;
  END IF;

  IF NEW.comments IS NULL OR NEW.comments = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_test_case FROM public.uat_test_cases WHERE id = NEW.test_case_id;
  IF v_test_case.test_label IS NULL OR v_test_case.test_label = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_uat_sheet FROM public.uat_sheets WHERE id = v_test_case.uat_sheet_id;
  SELECT d.* INTO v_deployment FROM public.deployments d WHERE d.id = v_uat_sheet.deployment_id;

  IF v_deployment.agent_designer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_priority := CASE
    WHEN NEW.result = 'Fail - Bad UX' THEN 'High'
    WHEN NEW.result = 'Fail - Good UX' THEN 'Medium'
    ELSE 'Low'
  END;

  v_ticket_type := CASE WHEN NEW.round_number = 1 THEN 'UAT' ELSE 'Retest' END;
  v_ticket_summary := v_test_case.test_label ||
    CASE WHEN NEW.round_number > 1 THEN ' (Retest R' || NEW.round_number || ')' ELSE '' END ||
    ' - [Row ' || v_test_case.row_number || ']';

  v_ticket_description := E'**Test Case:** ' || v_test_case.test_label || E'\n' ||
                         E'**Test Script:**\n' || COALESCE(v_test_case.test_script, 'N/A') || E'\n\n' ||
                         E'**Round:** ' || NEW.round_number || E'\n' ||
                         E'**Result:** ' || NEW.result || E'\n' ||
                         E'**Tester:** ' || COALESCE(NEW.tester_name, 'Not specified') || E'\n' ||
                         E'**Call Recording:** ' || COALESCE(NEW.call_link, 'Not provided') || E'\n\n' ||
                         E'**Tester Feedback:**\n' || NEW.comments || E'\n\n' ||
                         E'---\n' ||
                         E'**Deployment:** ' || v_deployment.client_name || ' (' || v_deployment.jira_component || ')' || E'\n' ||
                         E'**UAT Sheet:** ' || v_uat_sheet.name;

  v_epic_name := '[' || v_deployment.client_name || '] UAT';

  SELECT * INTO v_existing_ticket
  FROM public.pending_jira_tickets
  WHERE related_row_id = NEW.id::text
    AND exported = false
  LIMIT 1;

  IF v_existing_ticket.id IS NOT NULL THEN
    IF OLD.comments IS DISTINCT FROM NEW.comments THEN
      v_log_change_type := 'feedback_updated';
      v_log_old_value := OLD.comments;
      v_log_new_value := NEW.comments;
    ELSIF OLD.result IS DISTINCT FROM NEW.result THEN
      v_log_change_type := 'result_changed';
      v_log_old_value := OLD.result;
      v_log_new_value := NEW.result;
    ELSE
      v_log_change_type := 'feedback_updated';
      v_log_old_value := 'Other field updated';
      v_log_new_value := 'Ticket refreshed';
    END IF;

    UPDATE public.pending_jira_tickets
    SET
      description = v_ticket_description,
      priority = v_new_priority,
      summary = v_ticket_summary
    WHERE id = v_existing_ticket.id;

    INSERT INTO public.jira_ticket_change_log (
      ticket_id, test_round_id, change_type, old_value, new_value, changed_by, deployment_id
    ) VALUES (
      v_existing_ticket.id,
      NEW.id,
      v_log_change_type,
      v_log_old_value,
      v_log_new_value,
      COALESCE(NEW.tester_name, 'Unknown'),
      v_deployment.id
    );

  ELSE
    INSERT INTO public.pending_jira_tickets (
      ticket_type, deployment_id, related_row_id, summary, description,
      priority, assignee_id, epic_name, space, component
    ) VALUES (
      v_ticket_type, v_deployment.id, NEW.id::text, v_ticket_summary, v_ticket_description,
      v_new_priority, v_deployment.agent_designer_id, v_epic_name,
      v_deployment.jira_component, v_deployment.client_name
    )
    RETURNING * INTO v_existing_ticket;

    INSERT INTO public.jira_ticket_change_log (
      ticket_id, test_round_id, change_type, old_value, new_value, changed_by, deployment_id
    ) VALUES (
      v_existing_ticket.id,
      NEW.id,
      'created',
      NULL,
      'Ticket created for ' || NEW.result,
      COALESCE(NEW.tester_name, 'Unknown'),
      v_deployment.id
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION create_jira_ticket_for_test_round() IS 'Creates JIRA tickets for test rounds using jira_component, skipping children in grouped issues';
COMMENT ON FUNCTION create_jira_ticket_for_issue() IS 'Creates JIRA tickets for issues using jira_component, skipping children in grouped issues';
