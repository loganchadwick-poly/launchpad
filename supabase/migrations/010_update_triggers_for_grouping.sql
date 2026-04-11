-- UAT & Hypercare Management Platform
-- Migration 010: Update JIRA Ticket Triggers for Issue Grouping
-- 
-- This migration updates the automatic JIRA ticket creation triggers to:
-- 1. Skip creating tickets for child rows (they're linked to parent)
-- 2. Include child info in parent ticket descriptions

-- =====================================================
-- DROP EXISTING TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS trigger_create_jira_ticket_on_round_result ON public.uat_test_rounds;
DROP FUNCTION IF EXISTS create_jira_ticket_for_test_round();

-- =====================================================
-- NEW FUNCTION: Create JIRA Ticket with grouping support
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
    
    -- GROUPING CHECK: If this test case has a parent, DON'T create a ticket
    -- Child rows share the parent's ticket
    IF v_test_case.parent_row_id IS NOT NULL THEN
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
    
    -- Check if this is a parent row with children (grouped issues)
    SELECT COUNT(*) INTO v_child_count
    FROM public.uat_test_cases
    WHERE parent_row_id = v_test_case.id;
    
    -- Build ticket summary
    IF v_child_count > 0 THEN
      -- This is a group parent
      v_ticket_summary := COALESCE(v_test_case.group_name, v_test_case.test_label) || ' (' || (v_child_count + 1) || ' issues)';
    ELSIF NEW.round_number = 1 THEN
      v_ticket_summary := v_test_case.test_label || ' - [Row ' || v_test_case.row_number || ']';
    ELSE
      v_ticket_summary := v_test_case.test_label || ' (Retest R' || NEW.round_number || ') - [Row ' || v_test_case.row_number || ']';
    END IF;
    
    -- Build base ticket description
    v_ticket_description := E'**Test Case:** ' || v_test_case.test_label || E'\n' ||
                           E'**Test Script:**\n' || COALESCE(v_test_case.test_script, 'N/A') || E'\n\n' ||
                           E'**Round:** ' || NEW.round_number || E'\n' ||
                           E'**Result:** ' || NEW.result || E'\n' ||
                           E'**Tester:** ' || COALESCE(NEW.tester_name, 'Not specified') || E'\n' ||
                           E'**Call Recording:** ' || COALESCE(NEW.call_link, 'Not provided') || E'\n\n' ||
                           E'**Tester Feedback:**\n' || COALESCE(NEW.comments, 'No feedback provided') || E'\n\n';
    
    -- If this is a group parent, add child information
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
-- RECREATE TRIGGER
-- =====================================================

CREATE TRIGGER trigger_create_jira_ticket_on_round_result
  AFTER INSERT OR UPDATE OF result ON public.uat_test_rounds
  FOR EACH ROW
  EXECUTE FUNCTION create_jira_ticket_for_test_round();

-- =====================================================
-- FUNCTION: Delete child tickets when grouped
-- When a row becomes a child (parent_row_id set), delete its pending tickets
-- =====================================================

CREATE OR REPLACE FUNCTION delete_child_tickets_on_group()
RETURNS TRIGGER AS $$
BEGIN
  -- If parent_row_id changed from NULL to a value (row became a child)
  IF OLD.parent_row_id IS NULL AND NEW.parent_row_id IS NOT NULL THEN
    -- Delete any pending (non-exported) tickets for this row's rounds
    DELETE FROM public.pending_jira_tickets
    WHERE related_row_id IN (
      SELECT id::text FROM public.uat_test_rounds WHERE test_case_id = NEW.id
    )
    AND exported = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_delete_child_tickets
  AFTER UPDATE OF parent_row_id ON public.uat_test_cases
  FOR EACH ROW
  EXECUTE FUNCTION delete_child_tickets_on_group();

-- =====================================================
-- SAME FOR ISSUES TABLE
-- =====================================================

DROP TRIGGER IF EXISTS trigger_create_issue_jira_ticket ON public.issues;
DROP FUNCTION IF EXISTS create_jira_ticket_for_issue();

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
  -- Only create ticket for new issues without a ticket
  IF NEW.jira_ticket_id IS NULL THEN
    
    -- GROUPING CHECK: If this issue has a parent, DON'T create a ticket
    IF NEW.parent_issue_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
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
    
    -- Check if this is a parent with children
    SELECT COUNT(*) INTO v_child_count
    FROM public.issues
    WHERE parent_issue_id = NEW.id;
    
    -- Build ticket summary
    IF v_child_count > 0 THEN
      v_ticket_summary := COALESCE(NEW.group_name, NEW.issue_name) || ' (' || (v_child_count + 1) || ' issues)';
    ELSE
      v_ticket_summary := NEW.issue_name;
    END IF;
    
    -- Build ticket description
    v_ticket_description := E'**Issue:** ' || NEW.issue_name || E'\n\n' ||
                           E'**Description:**\n' || NEW.issue_description || E'\n\n' ||
                           E'**Reported By:** ' || NEW.reported_by || E'\n' ||
                           E'**Date Reported:** ' || NEW.date_reported || E'\n' ||
                           E'**Time of Call:** ' || NEW.time_of_call || E'\n' ||
                           E'**Priority:** ' || NEW.priority || E'\n' ||
                           E'**Call Recording:** ' || COALESCE(NEW.call_url, 'Not provided') || E'\n\n';
    
    -- Add child information if this is a group parent
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

CREATE TRIGGER trigger_create_issue_jira_ticket
  AFTER INSERT ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION create_jira_ticket_for_issue();

-- Delete child tickets when issue is grouped
CREATE OR REPLACE FUNCTION delete_child_issue_tickets_on_group()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.parent_issue_id IS NULL AND NEW.parent_issue_id IS NOT NULL THEN
    DELETE FROM public.pending_jira_tickets
    WHERE related_row_id = NEW.id::text
    AND exported = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_delete_child_issue_tickets
  AFTER UPDATE OF parent_issue_id ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION delete_child_issue_tickets_on_group();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION create_jira_ticket_for_test_round() IS 'Creates JIRA tickets for test rounds, skipping children in grouped issues';
COMMENT ON FUNCTION create_jira_ticket_for_issue() IS 'Creates JIRA tickets for issues, skipping children in grouped issues';
COMMENT ON FUNCTION delete_child_tickets_on_group() IS 'Deletes pending tickets when a test case becomes a child in a group';
COMMENT ON FUNCTION delete_child_issue_tickets_on_group() IS 'Deletes pending tickets when an issue becomes a child in a group';
