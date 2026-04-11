'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/getUser'
import { randomBytes } from 'crypto'

function generateShareableLink(): string {
  return randomBytes(16).toString('hex')
}

export async function createIssueTracker(formData: FormData) {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('issue_trackers')
    .insert({
      deployment_id: formData.get('deployment_id') as string,
      name: formData.get('name') as string,
      shareable_link_token: generateShareableLink(),
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/deployments/${formData.get('deployment_id')}`)
  return { success: true, data }
}
