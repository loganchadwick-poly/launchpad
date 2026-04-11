import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/getUser'
import { signOut } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // Force dynamic rendering to prevent caching auth state
  const dynamic = 'force-dynamic'
  void dynamic

  // Get pending ticket count for nav badge
  const supabase = await createClient()
  const { count: pendingTicketCount } = await supabase
    .from('pending_jira_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('exported', false)

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        user={{ name: user.name, email: user.email, role: user.role }}
        pendingTicketCount={pendingTicketCount || 0}
        signOutAction={signOut}
      />

      <div className="flex flex-1 flex-col md:ml-[260px]">
        <TopBar />
        <main className="flex-1 overflow-y-auto page-container">
          {children}
        </main>
      </div>
    </div>
  )
}
