'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types/database.types'

export async function addTeamMember(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const name = formData.get('name') as string
  const role = formData.get('role') as UserRole
  const jira_username = formData.get('jira_username') as string | null

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    return { error: 'A user with this email already exists' }
  }

  // Create user profile (without auth account for now - they can sign up later)
  const { error } = await supabase
    .from('users')
    .insert({
      email,
      name,
      role,
      jira_username: jira_username || null,
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/team')
  return { success: true }
}

export async function updateTeamMember(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const role = formData.get('role') as UserRole
  const jira_username = formData.get('jira_username') as string | null

  const { data, error } = await supabase
    .from('users')
    .update({
      name,
      role,
      jira_username: jira_username || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Update team member error:', error)
    return { error: error.message }
  }

  if (!data) {
    return { error: 'Failed to update - user not found or permission denied' }
  }

  revalidatePath('/team')
  revalidatePath('/dashboard')
  revalidatePath('/deployments')
  return { success: true }
}

export async function deleteTeamMember(userId: string) {
  const supabase = await createClient()

  // Check if user is assigned to any deployments
  const { data: deployments } = await supabase
    .from('deployments')
    .select('id')
    .or(`agent_designer_id.eq.${userId},forward_deployed_engineer_id.eq.${userId}`)
    .limit(1)

  if (deployments && deployments.length > 0) {
    return { error: 'Cannot delete user who is assigned to deployments' }
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/team')
  return { success: true }
}
