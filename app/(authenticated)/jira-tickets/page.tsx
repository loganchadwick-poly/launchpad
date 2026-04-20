import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/getUser'
import TicketCard from './TicketCard'

export default async function JIRATicketsPage() {
  await getUser() // Ensure authenticated
  
  const supabase = await createClient()

  // Get all pending tickets
  const { data: tickets } = await supabase
    .from('pending_jira_tickets')
    .select(`
      *,
      deployment:deployment_id(
        id,
        client_name,
        jira_component
      )
    `)
    .order('created_at', { ascending: false })

  // Separate exported and pending
  const pendingTickets = tickets?.filter(t => !t.exported) || []
  const exportedTickets = tickets?.filter(t => t.exported) || []

  // Count by type (database uses 'UAT', 'Hypercare', 'Retest')
  const uatCount = pendingTickets.filter(t => t.ticket_type === 'UAT').length
  const issueCount = pendingTickets.filter(t => t.ticket_type === 'Hypercare').length
  const retestCount = pendingTickets.filter(t => t.ticket_type === 'Retest').length

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-brand-dark">JIRA Tickets</h1>
        <p className="mt-1 text-sm text-gray-600">
          Auto-generated tickets ready to be created in JIRA
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 card border-2 border-brand-purple bg-purple-50 p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-brand-purple mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-brand-dark mb-1">JIRA Export Queue</h3>
            <p className="text-sm text-gray-700">
              LaunchPad auto-drafts a JIRA ticket whenever a UAT case fails, a hypercare issue is reported,
              or a retest fails — pre-formatted with component, reporter, and repro steps. Paste into JIRA
              with one click, then mark as exported. Direct JIRA API push is a flag away once a service
              account is connected.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="card border-2 border-gray-300 bg-white p-4">
          <p className="text-2xl font-semibold text-brand-dark">{pendingTickets.length}</p>
          <p className="text-sm text-gray-600">Pending Tickets</p>
        </div>
        <div className="card border border-gray-200 bg-white p-4">
          <p className="text-2xl font-semibold text-brand-dark">{uatCount}</p>
          <p className="text-sm font-medium" style={{ color: '#231F20' }}>UAT Failures</p>
        </div>
        <div className="card border border-gray-200 bg-white p-4">
          <p className="text-2xl font-semibold text-brand-dark">{issueCount}</p>
          <p className="text-sm text-gray-700 font-medium">Hypercare Issues</p>
        </div>
        <div className="card border border-gray-200 bg-white p-4">
          <p className="text-2xl font-semibold text-brand-dark">{retestCount}</p>
          <p className="text-sm text-gray-700 font-medium">Retests</p>
        </div>
      </div>

      {/* Pending Tickets */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-brand-dark mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
            {pendingTickets.length}
          </span>
          Tickets to Create
        </h2>

        {pendingTickets.length === 0 ? (
          <div className="card p-12 text-center bg-white">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-medium text-gray-900">All caught up!</h3>
            <p className="mt-2 text-sm text-gray-500">No pending JIRA tickets at the moment</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>

      {/* Exported Tickets */}
      {exportedTickets.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-brand-dark mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Recently Exported ({exportedTickets.length})
          </h2>

          <div className="space-y-4">
            {exportedTickets.slice(0, 10).map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
