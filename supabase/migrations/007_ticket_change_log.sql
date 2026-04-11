-- UAT & Hypercare Management Platform
-- Migration 007: JIRA Ticket Change Logging & Update Support
-- 
-- This migration adds audit logging for JIRA ticket changes and updates
-- the trigger to handle feedback edits on existing tickets.

-- =====================================================
-- CREATE CHANGE LOG TABLE
-- =====================================================

CREATE TABLE public.jira_ticket_change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.pending_jira_tickets(id) ON DELETE SET NULL,
  test_round_id UUID REFERENCES public.uat_test_rounds(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'feedback_updated', 'result_changed')),
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT NOT NULL DEFAULT 'system',
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_ticket_log_ticket_id ON public.jira_ticket_change_log(ticket_id);
CREATE INDEX idx_ticket_log_round_id ON public.jira_ticket_change_log(test_round_id);
CREATE INDEX idx_ticket_log_deployment ON public.jira_ticket_change_log(deployment_id);
CREATE INDEX idx_ticket_log_created_at ON public.jira_ticket_change_log(created_at);
CREATE INDEX idx_ticket_log_change_type ON public.jira_ticket_change_log(change_type);

-- Enable RLS
ALTER TABLE public.jira_ticket_change_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view logs
CREATE POLICY "Authenticated users can view ticket logs"
  ON public.jira_ticket_change_log FOR SELECT
  TO authenticated
  USING (true);

-- System can insert logs (via triggers)
CREATE POLICY "Allow insert for ticket logs"
  ON public.jira_ticket_change_log FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- =====================================================
-- HELPER FUNCTION: Build ticket description
-- =====================================================

CREATE OR REPLACE FUNCTION build_ticket_description(
  p_test_case RECORD,
  p_round RECORD,
  p_deployment RECORD,
  p_uat_sheet RECORD
) RETURNS TEXT AS $$
BEGIN
  RETURN E'**Test Case:** ' || p_test_case.test_label || E'\n' ||
         E'**Test Script:**\n' || COALESCE(p_test_case.test_script, 'N/A') || E'\n\n' ||
         E'**Round:** ' || p_round.round_number || E'\n' ||
         E'**Result:** ' || p_round.result || E'\n' ||
         E'**Tester:** ' || COALESCE(p_round.tester_name, 'Not specified') || E'\n' ||
         E'**Call Recording:** ' || COALESCE(p_round.call_link, 'Not provided') || E'\n\n' ||
         E'**Tester Feedback:**\n' || COALESCE(p_round.comments, 'No feedback') || E'\n\n' ||
         E'---\n' ||
         E'**Deployment:** ' || p_deployment.client_name || ' (' || p_deployment.deployment_id || ')' || E'\n' ||
         E'**UAT Sheet:** ' || p_uat_sheet.name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATED TRIGGER FUNCTION: Handle create AND update
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
  -- Only process if result is set and not "As Designed - Perfect"
  IF NEW.result IS NULL OR NEW.result = 'As Designed - Perfect' THEN
    RETURN NEW;
  END IF;
  
  -- Only process if feedback is provided
  IF NEW.comments IS NULL OR NEW.comments = '' THEN
    RETURN NEW;
  END IF;
  
  -- Get related records
  SELECT * INTO v_test_case FROM public.uat_test_cases WHERE id = NEW.test_case_id;
  IF v_test_case.test_label IS NULL OR v_test_case.test_label = '' THEN 
    RETURN NEW; 
  END IF;
  
  SELECT * INTO v_uat_sheet FROM public.uat_sheets WHERE id = v_test_case.uat_sheet_id;
  SELECT d.* INTO v_deployment FROM public.deployments d WHERE d.id = v_uat_sheet.deployment_id;
  
  -- Skip if no Agent Designer assigned
  IF v_deployment.agent_designer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate priority based on result
  v_new_priority := CASE 
    WHEN NEW.result = 'Fail - Bad UX' THEN 'High'
    WHEN NEW.result = 'Fail - Good UX' THEN 'Medium'
    ELSE 'Low'
  END;
  
  -- Build ticket details
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
                         E'**Deployment:** ' || v_deployment.client_name || ' (' || v_deployment.deployment_id || ')' || E'\n' ||
                         E'**UAT Sheet:** ' || v_uat_sheet.name;
  
  v_epic_name := '[' || v_deployment.client_name || '] UAT';
  
  -- Check for existing pending ticket for this round
  SELECT * INTO v_existing_ticket 
  FROM public.pending_jira_tickets
  WHERE related_row_id = NEW.id::text 
    AND exported = false
  LIMIT 1;
  
  IF v_existing_ticket.id IS NOT NULL THEN
    -- UPDATE existing ticket
    
    -- Determine what changed
    IF OLD.comments IS DISTINCT FROM NEW.comments THEN
      v_log_change_type := 'feedback_updated';
      v_log_old_value := OLD.comments;
      v_log_new_value := NEW.comments;
    ELSIF OLD.result IS DISTINCT FROM NEW.result THEN
      v_log_change_type := 'result_changed';
      v_log_old_value := OLD.result;
      v_log_new_value := NEW.result;
    ELSE
      -- Something else changed (tester name, call link, etc.) - still update ticket
      v_log_change_type := 'feedback_updated';
      v_log_old_value := 'Other field updated';
      v_log_new_value := 'Ticket refreshed';
    END IF;
    
    -- Update the ticket
    UPDATE public.pending_jira_tickets
    SET 
      description = v_ticket_description,
      priority = v_new_priority,
      summary = v_ticket_summary
    WHERE id = v_existing_ticket.id;
    
    -- Log the change
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
    -- CREATE new ticket
    
    INSERT INTO public.pending_jira_tickets (
      ticket_type, deployment_id, related_row_id, summary, description, 
      priority, assignee_id, epic_name, space, component
    ) VALUES (
      v_ticket_type, v_deployment.id, NEW.id::text, v_ticket_summary, v_ticket_description,
      v_new_priority, v_deployment.agent_designer_id, v_epic_name, 
      v_deployment.jira_space, v_deployment.client_name
    )
    RETURNING * INTO v_existing_ticket;
    
    -- Log the creation
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
-- DROP OLD TRIGGER AND CREATE NEW ONE
-- =====================================================

DROP TRIGGER IF EXISTS trigger_create_jira_ticket_on_round_result ON public.uat_test_rounds;

CREATE TRIGGER trigger_create_or_update_jira_ticket
  AFTER INSERT OR UPDATE OF result, comments, tester_name, call_link ON public.uat_test_rounds
  FOR EACH ROW
  EXECUTE FUNCTION create_or_update_jira_ticket_for_test_round();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.jira_ticket_change_log IS 'Audit log tracking all changes to pending JIRA tickets';
COMMENT ON COLUMN public.jira_ticket_change_log.change_type IS 'Type of change: created, feedback_updated, or result_changed';
COMMENT ON COLUMN public.jira_ticket_change_log.changed_by IS 'Name of tester who made the change';
