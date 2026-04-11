import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/getUser'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AddIssueButton from './AddIssueButton'
import DraggableIssueTable from './DraggableIssueTable'
import CopyLinkButton from '@/app/components/CopyLinkButton'

export default async function IssueTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  await getUser() // Ensure authenticated
  const { id } = await params
  
  const supabase = await createClient()

  // Get issue tracker with deployment info
  const { data: issueTracker } = await supabase
    .from('issue_trackers')
    .select(`
      *,
      deployment:deployment_id(
        id,
        client_name,
        deployment_id,
        jira_space
      )
    `)
    .eq('id', id)
    .single()

  if (!issueTracker) {
    redirect('/deployments')
  }

  // Get all issues for this tracker
  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .eq('issue_tracker_id', id)
    .order('date_reported', { ascending: false })

  // Calculate stats
  const highPriorityCount = issues?.filter(i => i.priority === 'High').length || 0
  const resolvedCount = issues?.filter(i => i.status === 'Resolved').length || 0
  const inProgressCount = issues?.filter(i => i.status === 'In Progress').length || 0

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <Link href="/deployments" className="hover:text-brand-dark">Deployments</Link>
          <span>/</span>
          <Link href={`/deployments/${issueTracker.deployment.id}`} className="hover:text-brand-dark">
            {issueTracker.deployment.client_name}
          </Link>
          <span>/</span>
          <span className="text-brand-dark">{issueTracker.name}</span>
        </div>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-brand-dark">{issueTracker.name}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {issueTracker.deployment.client_name} • {issueTracker.deployment.deployment_id}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CopyLinkButton link={`/shared/issues/${issueTracker.shareable_link_token}`} label="Share with Client" />
            <AddIssueButton issueTrackerId={id} />
          </div>
        </div>
      </div>

      {/* Client Link Info */}
      <div className="mb-6 card border-2 border-brand-coral bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-brand-dark mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-brand-dark">Client Access</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Click &quot;Share with Client&quot; to copy the shareable link. Clients can report issues without logging in.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-2xl font-semibold text-brand-dark">{issues?.length || 0}</p>
          <p className="text-sm text-gray-600">Total Issues</p>
        </div>
        <div className="card border-2 border-red-200 bg-red-50 p-4">
          <p className="text-2xl font-semibold text-brand-dark">{highPriorityCount}</p>
          <p className="text-sm text-red-700 font-medium">High Priority</p>
        </div>
        <div className="card border-2 border-yellow-200 bg-yellow-50 p-4">
          <p className="text-2xl font-semibold text-brand-dark">{inProgressCount}</p>
          <p className="text-sm text-yellow-700 font-medium">In Progress</p>
        </div>
        <div className="card border-2 border-green-200 bg-green-50 p-4">
          <p className="text-2xl font-semibold text-brand-dark">{resolvedCount}</p>
          <p className="text-sm text-green-700 font-medium">Resolved</p>
        </div>
      </div>

      {/* Issues Table - with Drag & Drop Grouping */}
      {!issues || issues.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-medium text-gray-900">No issues yet</h3>
          <p className="mt-2 text-sm text-gray-500">Add your first issue to start tracking hypercare</p>
          <div className="mt-6">
            <AddIssueButton issueTrackerId={id} />
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Tip */}
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 text-xs text-brand-dark">
            <span className="font-medium">Tip:</span> Drag issues onto each other to group related issues. Grouped issues share a single JIRA ticket.
          </div>
          <div className="overflow-x-auto">
            <DraggableIssueTable issues={issues} issueTrackerId={id} />
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 card border-2 border-gray-300 bg-gray-50 p-4 text-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="font-medium text-brand-dark mb-2">Priority Levels:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-red-100 border border-red-300"></div>
                <span className="text-gray-700">High - Immediate attention</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-yellow-100 border border-yellow-300"></div>
                <span className="text-gray-700">Medium - Normal priority</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-blue-100 border border-blue-300"></div>
                <span className="text-gray-700">Low - Can wait</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium text-brand-dark mb-2">Status Types:</p>
            <div className="space-y-1 text-gray-700 text-xs">
              <p>• In Progress - Being worked on</p>
              <p>• Backlogged - Scheduled for future</p>
              <p>• Resolved - Issue has been fixed</p>
              <p>• More Info Needed - Awaiting details</p>
              <p>• Non-Actionable - Not a valid issue</p>
              <p>• Accepted for Fix - Confirmed</p>
            </div>
          </div>
          <div>
            <p className="font-medium text-brand-dark mb-2">Issue Grouping:</p>
            <div className="space-y-1.5 text-gray-600">
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
                <span className="text-xs">Drag to group related issues</span>
              </p>
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                </svg>
                <span className="text-xs">Groups share one JIRA ticket</span>
              </p>
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="text-xs">Click group name to edit</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
