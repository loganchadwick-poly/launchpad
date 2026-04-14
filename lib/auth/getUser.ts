import { createClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types/database.types'

// When NEXT_PUBLIC_BYPASS_AUTH is set, skip Supabase auth and return a mock user.
// This lets the app run without platform auth integration.
// To use: add NEXT_PUBLIC_BYPASS_AUTH=true to .env.local
const MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'dev@launchpad.local',
  name: 'Dev User',
  role: 'PSM',
  jira_username: null,
  created_at: new Date().toISOString(),
}

export function isAuthBypassed(): boolean {
  // NEXT_PUBLIC_ is inlined at build time for client code.
  // BYPASS_AUTH is read at runtime for server components/actions.
  return process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true' || process.env.BYPASS_AUTH === 'true'
}

export async function getUser(): Promise<User | null> {
  if (isAuthBypassed()) return MOCK_USER

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
