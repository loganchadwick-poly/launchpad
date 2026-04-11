-- Fix: Allow authenticated users to update any team member
-- The previous policy only allowed users to update their own profile
-- This change allows PSMs and other admins to manage team members

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create a more permissive policy for team management
CREATE POLICY "Authenticated users can update any user"
  ON public.users FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Also add delete policy for team management
CREATE POLICY "Authenticated users can delete users"
  ON public.users FOR DELETE
  USING (auth.uid() IS NOT NULL);
