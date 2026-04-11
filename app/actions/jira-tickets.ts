'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/getUser'

export async function markTicketAsExported(ticketId: string) {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('pending_jira_tickets')
    .update({
      exported: true,
      exported_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/jira-tickets')
  return { success: true }
}

export async function deleteTicket(ticketId: string) {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('pending_jira_tickets')
    .delete()
    .eq('id', ticketId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/jira-tickets')
  return { success: true }
}
