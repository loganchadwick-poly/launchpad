-- =====================================================
-- Migration 013: Skip JIRA ticket creation when no assignee
-- =====================================================
-- The INSERT-path function create_jira_ticket_for_test_round() was blindly
-- assigning v_deployment.agent_designer_id to pending_jira_tickets.assignee_id,
-- which is NOT NULL. When a deployment has no AD assigned yet (common early
-- in setup) this crashes the round insert — breaking bulk CSV imports.
--
-- The UPDATE-path sibling (create_or_update_jira_ticket_for_test_round) and
-- the issues function (create_jira_ticket_for_issue) already have this guard.
-- Adding it to keep behaviour consistent and make imports robust to missing
-- assignees.
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

    -- NEW: skip ticket creation if no AD assigned (match UPDATE-path guard).
    -- Ticket will be created later when AD is assigned and the round is touched.
    IF v_deployment.agent_designer_id IS NULL THEN
      RETURN NEW;
    END IF;

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
