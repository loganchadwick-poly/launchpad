-- UAT & Hypercare Management Platform - Automatic JIRA Ticket Creation
-- Step 2: Database Functions and Triggers

-- =====================================================
-- FUNCTION: Create JIRA Ticket for UAT Test Case
-- =====================================================

CREATE OR REPLACE FUNCTION create_jira_ticket_for_uat()
RETURNS TRIGGER AS $$
DECLARE
  v_deployment RECORD;
  v_uat_sheet RECORD;
  v_assignee RECORD;
  v_ticket_summary TEXT;
  v_ticket_description TEXT;
  v_epic_name TEXT;
BEGIN
  -- Only create ticket if result is not "As Designed - Perfect" and result changed
  IF NEW.result IS NOT NULL 
     AND NEW.result != 'As Designed - Perfect'
     AND (OLD.result IS NULL OR OLD.result != NEW.result OR OLD.result = 'As Designed - Perfect')
     AND NEW.jira_ticket_id IS NULL THEN
    
    -- Get UAT sheet info
    SELECT * INTO v_uat_sheet FROM public.uat_sheets WHERE id = NEW.uat_sheet_id;
    
    -- Get deployment info with assignee
    SELECT 
      d.*,
      u.name as assignee_name,
      u.jira_username as assignee_jira
    INTO v_deployment
    FROM public.deployments d
    JOIN public.users u ON u.id = d.agent_designer_id
    WHERE d.id = v_uat_sheet.deployment_id;
    
    -- Build ticket summary
    v_ticket_summary := NEW.test_label || ' - [Row ' || NEW.row_number || ']';
    
    -- Build ticket description
    v_ticket_description := E'**Test Script:**\n' || NEW.test_script || E'\n\n' ||
                           E'**Result:** ' || NEW.result || E'\n' ||
                           E'**Tester:** ' || NEW.tester_name || E'\n' ||
                           E'**Call Recording:** ' || NEW.call_link || E'\n\n' ||
                           E'**Feedback:**\n' || NEW.comments_feedback || E'\n\n' ||
                           E'---\n' ||
                           E'[View in UAT Platform](https://your-app.vercel.app/uat-sheets/' || v_uat_sheet.id || ')';
    
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
      'UAT',
      v_deployment.id,
      NEW.id::text,
      v_ticket_summary,
      v_ticket_description,
      'Medium',
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
-- FUNCTION: Create JIRA Ticket for Retest
-- =====================================================

CREATE OR REPLACE FUNCTION create_jira_ticket_for_retest()
RETURNS TRIGGER AS $$
DECLARE
  v_deployment RECORD;
  v_uat_sheet RECORD;
  v_ticket_summary TEXT;
  v_ticket_description TEXT;
  v_epic_name TEXT;
BEGIN
  -- Only create retest ticket if retest result is not "As Designed - Perfect"
  IF NEW.retest_result IS NOT NULL 
     AND NEW.retest_result != 'As Designed - Perfect'
     AND (OLD.retest_result IS NULL OR OLD.retest_result != NEW.retest_result)
     AND NEW.retest_jira_ticket_id IS NULL THEN
    
    -- Get UAT sheet info
    SELECT * INTO v_uat_sheet FROM public.uat_sheets WHERE id = NEW.uat_sheet_id;
    
    -- Get deployment info
    SELECT d.* INTO v_deployment
    FROM public.deployments d
    WHERE d.id = v_uat_sheet.deployment_id;
    
    -- Build ticket summary with (Retest)
    v_ticket_summary := NEW.test_label || ' (Retest) - [Row ' || NEW.row_number || ']';
    
    -- Build ticket description with retest info
    v_ticket_description := E'**Test Script:**\n' || NEW.test_script || E'\n\n' ||
                           E'**Original Result:** ' || COALESCE(NEW.result, 'N/A') || E'\n' ||
                           E'**Retest Result:** ' || NEW.retest_result || E'\n' ||
                           E'**Retester:** ' || COALESCE(NEW.retester_name, NEW.tester_name) || E'\n' ||
                           E'**Retest Call Recording:** ' || COALESCE(NEW.retest_call_link, '') || E'\n\n' ||
                           E'**Retest Comments:**\n' || COALESCE(NEW.retest_comments, '') || E'\n\n' ||
                           E'**Retest Feedback:**\n' || COALESCE(NEW.retest_feedback, '') || E'\n\n' ||
                           E'**Original JIRA Ticket:** ' || COALESCE(NEW.jira_ticket_id, 'N/A') || E'\n\n' ||
                           E'---\n' ||
                           E'[View in UAT Platform](https://your-app.vercel.app/uat-sheets/' || v_uat_sheet.id || ')';
    
    -- Build epic name
    v_epic_name := '[' || v_deployment.client_name || '] UAT';
    
    -- Insert pending JIRA ticket for retest
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
      'Retest',
      v_deployment.id,
      NEW.id::text,
      v_ticket_summary,
      v_ticket_description,
      'Medium',
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
-- FUNCTION: Create JIRA Ticket for Issues
-- =====================================================

CREATE OR REPLACE FUNCTION create_jira_ticket_for_issue()
RETURNS TRIGGER AS $$
DECLARE
  v_deployment RECORD;
  v_issue_tracker RECORD;
  v_ticket_summary TEXT;
  v_ticket_description TEXT;
  v_epic_name TEXT;
  v_jira_priority TEXT;
BEGIN
  -- Only create ticket for new issues or when issue is updated without a ticket
  IF (TG_OP = 'INSERT' AND NEW.jira_ticket_id IS NULL)
     OR (TG_OP = 'UPDATE' AND OLD.jira_ticket_id IS NULL AND NEW.jira_ticket_id IS NULL 
         AND (OLD.issue_name != NEW.issue_name OR OLD.issue_description != NEW.issue_description)) THEN
    
    -- Get issue tracker info
    SELECT * INTO v_issue_tracker FROM public.issue_trackers WHERE id = NEW.issue_tracker_id;
    
    -- Get deployment info
    SELECT d.* INTO v_deployment
    FROM public.deployments d
    WHERE d.id = v_issue_tracker.deployment_id;
    
    -- Build ticket summary
    v_ticket_summary := NEW.issue_name || ' - [Issue ' || NEW.id || ']';
    
    -- Map priority
    v_jira_priority := NEW.priority;
    
    -- Build ticket description
    v_ticket_description := E'**Issue Description:**\n' || NEW.issue_description || E'\n\n' ||
                           E'**Reported By:** ' || NEW.reported_by || E'\n' ||
                           E'**Date/Time:** ' || NEW.date_reported || ' at ' || NEW.time_of_call || E'\n' ||
                           E'**Priority:** ' || NEW.priority || E'\n' ||
                           E'**Call Recording:** ' || NEW.call_url || E'\n\n' ||
                           E'---\n' ||
                           E'[View in UAT Platform](https://your-app.vercel.app/issue-trackers/' || v_issue_tracker.id || ')';
    
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
      v_jira_priority,
      v_deployment.forward_deployed_engineer_id,
      v_epic_name,
      v_deployment.jira_space,
      v_deployment.client_name
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger for UAT test case result changes
CREATE TRIGGER trigger_create_uat_jira_ticket
  AFTER INSERT OR UPDATE OF result ON public.uat_test_cases
  FOR EACH ROW
  EXECUTE FUNCTION create_jira_ticket_for_uat();

-- Trigger for UAT retest result changes
CREATE TRIGGER trigger_create_retest_jira_ticket
  AFTER UPDATE OF retest_result ON public.uat_test_cases
  FOR EACH ROW
  EXECUTE FUNCTION create_jira_ticket_for_retest();

-- Trigger for new issues
CREATE TRIGGER trigger_create_issue_jira_ticket
  AFTER INSERT OR UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION create_jira_ticket_for_issue();
