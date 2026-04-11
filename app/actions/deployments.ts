'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/getUser'
import type { CreateDeploymentInput } from '@/lib/types/database.types'

export async function createDeployment(formData: FormData) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return { error: 'Not authenticated. Please sign in again.' }
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!user) {
    return { error: 'User profile not found.' }
  }

  const agentDesignerId = formData.get('agent_designer_id') as string
  const fdeId = formData.get('forward_deployed_engineer_id') as string

  const deployment: CreateDeploymentInput & { created_by: string } = {
    client_name: formData.get('client_name') as string,
    deployment_id: formData.get('deployment_id') as string,
    jira_space: formData.get('jira_space') as 'HP' | 'HSP' | 'RL',
    agent_designer_id: agentDesignerId || null,
    forward_deployed_engineer_id: fdeId || null,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('deployments')
    .insert(deployment)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/deployments')
  revalidatePath('/dashboard')
  return { success: true, id: data.id }
}

export async function getDeployments() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deployments')
    .select(`
      *,
      agent_designer:users!agent_designer_id(id, name, email),
      forward_deployed_engineer:users!forward_deployed_engineer_id(id, name, email),
      uat_sheets(id, name),
      issue_trackers(id, name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching deployments:', error)
    return []
  }

  return data || []
}

export async function getDeployment(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deployments')
    .select(`
      *,
      agent_designer:users!agent_designer_id(id, name, email, jira_username),
      forward_deployed_engineer:users!forward_deployed_engineer_id(id, name, email, jira_username)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching deployment:', error)
    return null
  }

  return data
}

export async function updateDeployment(formData: FormData) {
  await requireAuth()
  const supabase = await createClient()

  const id = formData.get('id') as string
  const agentDesignerId = formData.get('agent_designer_id') as string
  const fdeId = formData.get('forward_deployed_engineer_id') as string

  const updates = {
    client_name: formData.get('client_name') as string,
    deployment_id: formData.get('deployment_id') as string,
    jira_space: formData.get('jira_space') as 'HP' | 'HSP' | 'RL',
    agent_designer_id: agentDesignerId || null,
    forward_deployed_engineer_id: fdeId || null,
  }

  const { error } = await supabase
    .from('deployments')
    .update(updates)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/deployments/${id}`)
  revalidatePath('/deployments')
  revalidatePath('/dashboard')
  return { success: true }
}
