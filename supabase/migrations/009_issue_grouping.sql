-- Issue Grouping Feature Migration
-- Adds parent-child relationships for grouping test cases and issues

-- =====================================================
-- UAT TEST CASES - Add grouping columns
-- =====================================================
ALTER TABLE public.uat_test_cases
ADD COLUMN parent_row_id UUID REFERENCES public.uat_test_cases(id) ON DELETE SET NULL,
ADD COLUMN group_name TEXT,
ADD COLUMN group_order INTEGER DEFAULT 0;

-- Index for faster parent lookups
CREATE INDEX idx_uat_test_cases_parent ON public.uat_test_cases(parent_row_id);

-- =====================================================
-- ISSUES - Add grouping columns
-- =====================================================
ALTER TABLE public.issues
ADD COLUMN parent_issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL,
ADD COLUMN group_name TEXT,
ADD COLUMN group_order INTEGER DEFAULT 0;

-- Index for faster parent lookups
CREATE INDEX idx_issues_parent ON public.issues(parent_issue_id);

-- =====================================================
-- FUNCTION: Propagate status from parent to children (UAT Test Cases)
-- This triggers when a parent's ticket status would change
-- =====================================================
CREATE OR REPLACE FUNCTION propagate_uat_group_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If this row is a parent (has children), update all children's ticket references
  -- This function can be extended later to sync with actual JIRA statuses
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Propagate status from parent to children (Issues)
-- =====================================================
CREATE OR REPLACE FUNCTION propagate_issue_group_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If this row is a parent (has children), update all children's status
  -- For now, just return - we'll handle this in application logic
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Auto-cleanup when group becomes size 1
-- When a row is ungrouped, check if only 1 row remains - if so, ungroup that too
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_single_member_groups()
RETURNS TRIGGER AS $$
DECLARE
  remaining_count INTEGER;
  parent_id UUID;
BEGIN
  -- Only run when parent_row_id changes (row is being ungrouped)
  IF OLD.parent_row_id IS NOT NULL AND NEW.parent_row_id IS NULL THEN
    parent_id := OLD.parent_row_id;
    
    -- Count remaining children for the old parent
    SELECT COUNT(*) INTO remaining_count
    FROM public.uat_test_cases
    WHERE parent_row_id = parent_id;
    
    -- If only the parent remains (0 children), clear its group_name
    IF remaining_count = 0 THEN
      UPDATE public.uat_test_cases
      SET group_name = NULL
      WHERE id = parent_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Similar function for issues table
CREATE OR REPLACE FUNCTION cleanup_single_member_issue_groups()
RETURNS TRIGGER AS $$
DECLARE
  remaining_count INTEGER;
  parent_id UUID;
BEGIN
  IF OLD.parent_issue_id IS NOT NULL AND NEW.parent_issue_id IS NULL THEN
    parent_id := OLD.parent_issue_id;
    
    SELECT COUNT(*) INTO remaining_count
    FROM public.issues
    WHERE parent_issue_id = parent_id;
    
    IF remaining_count = 0 THEN
      UPDATE public.issues
      SET group_name = NULL
      WHERE id = parent_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for cleanup
CREATE TRIGGER cleanup_uat_groups
  AFTER UPDATE OF parent_row_id ON public.uat_test_cases
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_single_member_groups();

CREATE TRIGGER cleanup_issue_groups
  AFTER UPDATE OF parent_issue_id ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_single_member_issue_groups();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON COLUMN public.uat_test_cases.parent_row_id IS 'Reference to parent row for grouped test cases. NULL if standalone.';
COMMENT ON COLUMN public.uat_test_cases.group_name IS 'Custom or auto-generated group name. Only set on parent rows.';
COMMENT ON COLUMN public.uat_test_cases.group_order IS 'Order within a group for drag-and-drop sorting.';

COMMENT ON COLUMN public.issues.parent_issue_id IS 'Reference to parent issue for grouped issues. NULL if standalone.';
COMMENT ON COLUMN public.issues.group_name IS 'Custom or auto-generated group name. Only set on parent rows.';
COMMENT ON COLUMN public.issues.group_order IS 'Order within a group for drag-and-drop sorting.';
