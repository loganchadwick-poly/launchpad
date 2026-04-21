import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/getUser'

export default async function Home() {
  // Route through getUser() so NEXT_PUBLIC_BYPASS_AUTH / BYPASS_AUTH are honored.
  const user = await getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
