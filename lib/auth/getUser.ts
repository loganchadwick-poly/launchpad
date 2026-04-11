import { createClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types/database.types'

export async function getUser(): Promise<User | null> {
  const supabase = await createClient()

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

  if (authError || !authUser) return null

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (profileError) {
    console.error('Profile lookup failed:', profileError.message, 'for auth user:', authUser.id)
    return null
  }

  return profile
}

export async function requireAuth(): Promise<User> {
  const user = await getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}
