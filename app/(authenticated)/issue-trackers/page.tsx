import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/getUser'
import Link from 'next/link'

export default async function IssueTrackersPage() {
  await getUser() // Ensure authenticated
  const supabase = await createClient()

  // Get all issue trackers with deployment info and issue count
  const { data: issueTrackers } = await supabase
    .from('issue_trackers')
    .select(`
      *,
      deployment:deployment_id(
        id,
        client_name,
        jira_component
      ),
      issues(id)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between opacity-0 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Issue Trackers</h1>
          <p className="text-sm text-gray-600">
            Track and manage hypercare issues across deployments
          </p>
        </div>
      </div>

      {/* Issue Trackers List */}
      {!issueTrackers || issueTrackers.length === 0 ? (
        <div className="card p-16 text-center opacity-0 animate-fade-in stagger-1">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="mt-6 text-lg font-semibold text-brand-dark">No issue trackers yet</h3>
          <p className="mt-2 text-gray-500 max-w-sm mx-auto">
            Issue trackers are created from within a deployment. Go to a deployment to create one.
          </p>
          <div className="mt-8">
            <Link href="/deployments" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              View Deployments
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4 opacity-0 animate-fade-in stagger-1">
          {issueTrackers.map((tracker) => {
            const issueCount = tracker.issues?.length || 0
            return (
              <Link
                key={tracker.id}
                href={`/issue-trackers/${tracker.id}`}
                className="card-hover block overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                      <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-brand-dark">
                        {tracker.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{tracker.deployment?.client_name}</span>
                        {tracker.deployment?.jira_component && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="font-mono text-xs">{tracker.deployment.jira_component}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {issueCount > 0 && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gray-200 px-2 text-xs font-bold text-gray-700">
                        {issueCount}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(tracker.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
