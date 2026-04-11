import { createClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types/database.types'

export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  if (!authUser) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return profile
}

export async function requireAuth(): Promise<User> {
  const user = await getUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}
