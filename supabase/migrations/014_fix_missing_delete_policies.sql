-- Fix missing DELETE policies on core tables.
--
-- Migration 002 enabled RLS on deployments, uat_sheets, and issue_trackers
-- but only added SELECT/INSERT/UPDATE policies. With RLS on and no DELETE
-- policy, every DELETE silently affects zero rows — so the client-facing
-- "Delete UAT Sheet" action returned success but the row stayed put.
--
-- We mirror the permissive style already used elsewhere in 002 (USING (true))
-- so authenticated users and bypass-mode callers both succeed. Tightening
-- these can happen later as part of a full RLS pass.

CREATE POLICY "Authenticated users can delete UAT sheets"
  ON public.uat_sheets FOR DELETE
  USING (true);

CREATE POLICY "Authenticated users can delete deployments"
  ON public.deployments FOR DELETE
  USING (true);

CREATE POLICY "Authenticated users can delete issue trackers"
  ON public.issue_trackers FOR DELETE
  USING (true);
