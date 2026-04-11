'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addIssue(formData: FormData) {
  const supabase = await createClient()
  
  const issueTrackerId = formData.get('issue_tracker_id') as string

  const { error } = await supabase
    .from('issues')
    .insert({
      issue_tracker_id: issueTrackerId,
      date_reported: formData.get('date_reported') as string || new Date().toISOString().split('T')[0],
      reported_by: formData.get('reported_by') as string,
      time_of_call: formData.get('time_of_call') as string || new Date().toTimeString().split(' ')[0],
      issue_name: formData.get('issue_name') as string,
      call_url: formData.get('call_url') as string || '',
      issue_description: formData.get('issue_description') as string || '',
      priority: formData.get('priority') as string || 'Medium',
      status: formData.get('status') as string || 'In Progress',
      polyai_notes: '',
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/issue-trackers/${issueTrackerId}`)
  return { success: true }
}

export async function updateIssue(formData: FormData) {
  const supabase = await createClient()
  
  const id = formData.get('id') as string
  const issueTrackerId = formData.get('issue_tracker_id') as string
  
  const updates: Record<string, string | null> = {}
  
  // Only update fields that are present in formData
  const fields = [
    'date_reported', 'reported_by', 'time_of_call', 'issue_name',
    'call_url', 'issue_description', 'priority', 'status',
    'expected_fix_date', 'issue_url', 'polyai_notes'
  ]
  
  fields.forEach(field => {
    const value = formData.get(field)
    if (value !== null && typeof value === 'string') {
      updates[field] = value
    }
  })

  const { error } = await supabase
    .from('issues')
    .update(updates)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/issue-trackers/${issueTrackerId}`)
  return { success: true }
}

export async function deleteIssue(id: string, issueTrackerId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('issues')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/issue-trackers/${issueTrackerId}`)
  return { success: true }
}
