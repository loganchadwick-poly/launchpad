-- UAT & Hypercare Management Platform
-- Migration 006: Update JIRA Ticket Triggers for uat_test_rounds Schema
-- 
-- This migration updates the automatic JIRA ticket creation triggers to work
-- with the new multi-round testing schema (uat_test_rounds table).

-- =====================================================
-- DROP OLD TRIGGERS (they reference non-existent columns)
-- =====================================================

DROP TRIGGER IF EXISTS trigger_create_uat_jira_ticket ON public.uat_test_cases;
DROP TRIGGER IF EXISTS trigger_create_retest_jira_ticket ON public.uat_test_cases;

DROP FUNCTION IF EXISTS create_jira_ticket_for_uat();
DROP FUNCTION IF EXISTS create_jira_ticket_for_retest();

-- =====================================================
-- NEW FUNCTION: Create JIRA Ticket when test round has non-perfect result
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
BEGIN
  -- Only create ticket if:
  -- 1. Result is set and not "As Designed - Perfect"
  -- 2. Result changed from NULL or from Perfect
  IF NEW.result IS NOT NULL 
     AND NEW.result != 'As Designed - Perfect'
     AND (OLD.result IS NULL OR OLD.result = 'As Designed - Perfect' OR OLD.result != NEW.result) THEN
    
    -- Get test case info
    SELECT * INTO v_test_case FROM public.uat_test_cases WHERE id = NEW.test_case_id;
    
    -- Skip if test case has no label (empty row)
    IF v_test_case.test_label IS NULL OR v_test_case.test_label = '' THEN
      RETURN NEW;
    END IF;
    
    -- Get UAT sheet info
    SELECT * INTO v_uat_sheet FROM public.uat_sheets WHERE id = v_test_case.uat_sheet_id;
    
    -- Get deployment info with AD assignee
    SELECT 
      d.*,
      u.name as assignee_name,
      u.jira_username as assignee_jira
    INTO v_deployment
    FROM public.deployments d
    LEFT JOIN public.users u ON u.id = d.agent_designer_id
    WHERE d.id = v_uat_sheet.deployment_id;
    
    -- Check if we already have a ticket for this test case + round combination
    SELECT COUNT(*) INTO v_existing_ticket_count
    FROM public.pending_jira_tickets
    WHERE related_row_id = NEW.id::text
      AND exported = false;
    
    -- Don't create duplicate tickets
    IF v_existing_ticket_count > 0 THEN
      RETURN NEW;
    END IF;
    
    -- Determine ticket type based on round number
    IF NEW.round_number = 1 THEN
      v_ticket_type := 'UAT';
    ELSE
      v_ticket_type := 'Retest';
    END IF;
    
    -- Build ticket summary
    IF NEW.round_number = 1 THEN
      v_ticket_summary := v_test_case.test_label || ' - [Row ' || v_test_case.row_number || ']';
    ELSE
      v_ticket_summary := v_test_case.test_label || ' (Retest R' || NEW.round_number || ') - [Row ' || v_test_case.row_number || ']';
    END IF;
    
    -- Build ticket description
    v_ticket_description := E'**Test Case:** ' || v_test_case.test_label || E'\n' ||
                           E'**Test Script:**\n' || COALESCE(v_test_case.test_script, 'N/A') || E'\n\n' ||
                           E'**Round:** ' || NEW.round_number || E'\n' ||
                           E'**Result:** ' || NEW.result || E'\n' ||
                           E'**Tester:** ' || COALESCE(NEW.tester_name, 'Not specified') || E'\n' ||
                           E'**Call Recording:** ' || COALESCE(NEW.call_link, 'Not provided') || E'\n\n' ||
                           E'**Tester Feedback:**\n' || COALESCE(NEW.comments, 'No feedback provided') || E'\n\n' ||
                           E'---\n' ||
                           E'**Deployment:** ' || v_deployment.client_name || ' (' || v_deployment.deployment_id || ')' || E'\n' ||
                           E'**UAT Sheet:** ' || v_uat_sheet.name;
    
    -- Build epic name
    v_epic_name := '[' || v_deployment.client_name || '] UAT';
    
    -- Insert pending JIRA ticket
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
      v_deployment.jira_space,
      v_deployment.client_name
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- NEW TRIGGER: Fire on uat_test_rounds updates
-- =====================================================

CREATE TRIGGER trigger_create_jira_ticket_on_round_result
  AFTER INSERT OR UPDATE OF result ON public.uat_test_rounds
  FOR EACH ROW
  EXECUTE FUNCTION create_jira_ticket_for_test_round();

-- =====================================================
-- UPDATED FUNCTION: Create JIRA Ticket for Issues (unchanged but refreshed)
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
BEGIN
  -- Only create ticket for new issues without a ticket
  IF NEW.jira_ticket_id IS NULL THEN
    
    -- Check if we already have a pending ticket for this issue
    SELECT COUNT(*) INTO v_existing_ticket_count
    FROM public.pending_jira_tickets
    WHERE related_row_id = NEW.id::text
      AND exported = false;
    
    -- Don't create duplicate tickets
    IF v_existing_ticket_count > 0 THEN
      RETURN NEW;
    END IF;
    
    -- Get issue tracker info
    SELECT * INTO v_issue_tracker FROM public.issue_trackers WHERE id = NEW.issue_tracker_id;
    
    -- Get deployment info with FDE assignee
    SELECT d.* INTO v_deployment
    FROM public.deployments d
    WHERE d.id = v_issue_tracker.deployment_id;
    
    -- Build ticket summary
    v_ticket_summary := NEW.issue_name;
    
    -- Build ticket description
    v_ticket_description := E'**Issue:** ' || NEW.issue_name || E'\n\n' ||
                           E'**Description:**\n' || NEW.issue_description || E'\n\n' ||
                           E'**Reported By:** ' || NEW.reported_by || E'\n' ||
                           E'**Date Reported:** ' || NEW.date_reported || E'\n' ||
                           E'**Time of Call:** ' || NEW.time_of_call || E'\n' ||
                           E'**Priority:** ' || NEW.priority || E'\n' ||
                           E'**Call Recording:** ' || COALESCE(NEW.call_url, 'Not provided') || E'\n\n' ||
                           E'---\n' ||
                           E'**Deployment:** ' || v_deployment.client_name || ' (' || v_deployment.deployment_id || ')' || E'\n' ||
                           E'**Issue Tracker:** ' || v_issue_tracker.name;
    
    -- Build epic name
    v_epic_name := '[' || v_deployment.client_name || '] Hypercare';
    
    -- Insert pending JIRA ticket
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
      v_deployment.jira_space,
      v_deployment.client_name
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the issue trigger (drop first to be safe)
DROP TRIGGER IF EXISTS trigger_create_issue_jira_ticket ON public.issues;

CREATE TRIGGER trigger_create_issue_jira_ticket
  AFTER INSERT ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION create_jira_ticket_for_issue();
