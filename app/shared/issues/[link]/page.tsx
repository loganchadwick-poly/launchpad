import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientIssueRow from './ClientIssueRow'
import AddClientIssueButton from './AddClientIssueButton'

export default async function SharedIssuesPage({ params }: { params: Promise<{ link: string }> }) {
  const { link } = await params
  const supabase = await createClient()

  // Get issue tracker by shareable link (public access)
  const { data: issueTracker } = await supabase
    .from('issue_trackers')
    .select(`
      *,
      deployment:deployment_id(
        id,
        client_name,
        deployment_id
      )
    `)
    .eq('shareable_link_token', link)
    .single()

  if (!issueTracker) {
    notFound()
  }

  // Get all issues
  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .eq('issue_tracker_id', issueTracker.id)
    .order('date_reported', { ascending: false })

  // Calculate stats
  const highPriorityCount = issues?.filter(i => i.priority === 'High').length || 0
  const resolvedCount = issues?.filter(i => i.status === 'Resolved').length || 0
  const totalIssues = issues?.length || 0
  const openCount = totalIssues - resolvedCount

  return (
    <div className="min-h-screen bg-[#F5F5F5]">

      {/* Header Bar */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-coral to-rose-500 shadow-lg shadow-brand-coral/20">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-brand-dark tracking-tight">{issueTracker.name}</h1>
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <span className="font-medium text-brand-dark">{issueTracker.deployment.client_name}</span>
                <span className="text-gray-400">•</span>
                <span>Issue Tracker</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Message */}
        <div className="mb-8 card border border-gray-200 bg-white p-8 opacity-0 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-coral/20 flex-shrink-0">
              <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-brand-dark mb-2">Report Hypercare Issues</h2>
              <p className="text-gray-600 mb-5 leading-relaxed">
                Use this page to report any issues you encounter during hypercare. 
                Our team will be notified and will work to resolve them as quickly as possible.
              </p>
              <AddClientIssueButton issueTrackerId={issueTracker.id} shareableLink={link} />
            </div>
          </div>
        </div>

        {/* Stats - Keep color-coded for status types */}
        <div className="mb-8 grid gap-4 sm:grid-cols-4 opacity-0 animate-fade-in stagger-1">
          <div className="card bg-white p-5 border border-gray-200">
            <p className="text-3xl font-bold text-brand-dark">{totalIssues}</p>
            <p className="text-sm font-medium text-gray-600">Total Issues</p>
          </div>
          <div className="card bg-amber-50 p-5 border border-amber-200">
            <p className="text-3xl font-bold text-amber-700">{openCount}</p>
            <p className="text-sm font-medium text-amber-700">Open</p>
          </div>
          <div className="card bg-rose-50 p-5 border border-rose-200">
            <p className="text-3xl font-bold text-rose-700">{highPriorityCount}</p>
            <p className="text-sm font-medium text-rose-700">High Priority</p>
          </div>
          <div className="card bg-emerald-50 p-5 border border-emerald-200">
            <p className="text-3xl font-bold text-emerald-700">{resolvedCount}</p>
            <p className="text-sm font-medium text-emerald-700">Resolved</p>
          </div>
        </div>

        {/* Issues List */}
        {!issues || issues.length === 0 ? (
          <div className="card p-16 text-center bg-white opacity-0 animate-fade-in stagger-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-6 text-lg font-semibold text-brand-dark">No issues reported yet</h3>
            <p className="mt-2 text-gray-500">Great news! Everything is running smoothly.</p>
          </div>
        ) : (
          <div className="space-y-3 opacity-0 animate-fade-in stagger-2">
            {issues.map((issue) => (
              <ClientIssueRow key={issue.id} issue={issue} shareableLink={link} />
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 card bg-slate-50 border border-slate-200 p-6 opacity-0 animate-fade-in stagger-3">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-brand-dark mb-2">When reporting an issue, please include:</p>
              <ul className="space-y-1.5 text-gray-600 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-brand-coral">•</span>
                  A clear description of what went wrong
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-coral">•</span>
                  The time the issue occurred
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-coral">•</span>
                  A link to the call recording (if available)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-coral">•</span>
                  Any other relevant details that could help us fix the problem
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 opacity-0 animate-fade-in stagger-4">
          <p>Powered by <span className="font-semibold text-brand-dark">PolyAI LaunchPad</span></p>
        </div>
      </div>
    </div>
  )
}
