-- Make Agent Designer and Forward Deployed Engineer optional for deployments
-- This allows deployments to be created without team member assignments for MVP/demo purposes

ALTER TABLE public.deployments 
  ALTER COLUMN agent_designer_id DROP NOT NULL;

ALTER TABLE public.deployments 
  ALTER COLUMN forward_deployed_engineer_id DROP NOT NULL;
