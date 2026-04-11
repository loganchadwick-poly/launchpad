import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/getUser'
import Link from 'next/link'
import EditDeploymentButton from './[id]/EditDeploymentButton'

export default async function DeploymentsPage() {
  await getUser() // Ensure authenticated
  const supabase = await createClient()

  // Get deployments with their UAT sheets and issue trackers
  const { data: deployments } = await supabase
    .from('deployments')
    .select(`
      *,
      agent_designer:agent_designer_id(id, name),
      forward_deployed_engineer:forward_deployed_engineer_id(id, name),
      uat_sheets(*),
      issue_trackers(*)
    `)
    .order('created_at', { ascending: false })

  // Get team members for the edit dropdown
  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, name, email, role')
    .order('name')

  const agentDesigners = teamMembers?.filter(u => u.role === 'AD') || []
  const fdes = teamMembers?.filter(u => u.role === 'FDE') || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between opacity-0 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Deployments</h1>
          <p className="text-sm text-gray-600">
            Manage client deployments and their UAT/hypercare tracking
          </p>
        </div>
        <Link href="/deployments/new" className="btn-primary inline-flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Deployment
        </Link>
      </div>

      {/* Deployments List */}
      {!deployments || deployments.length === 0 ? (
        <div className="card p-16 text-center opacity-0 animate-fade-in stagger-1">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="mt-6 text-lg font-semibold text-brand-dark">No deployments yet</h3>
          <p className="mt-2 text-gray-500 max-w-sm mx-auto">Get started by creating your first deployment to track UAT and hypercare.</p>
          <div className="mt-8">
            <Link href="/deployments/new" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Deployment
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4 opacity-0 animate-fade-in stagger-1">
          {deployments.map((deployment) => (
            <div key={deployment.id} className="card overflow-hidden">
              {/* Deployment Header */}
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <Link 
                    href={`/deployments/${deployment.id}`}
                    className="text-lg font-semibold text-brand-dark hover:underline transition-colors"
                  >
                    {deployment.client_name}
                  </Link>
                  <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {deployment.jira_space}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {deployment.deployment_id}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {deployment.agent_designer && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-gray-700">AD:</span> {deployment.agent_designer.name}
                      </span>
                    )}
                    {deployment.forward_deployed_engineer && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-gray-700">FDE:</span> {deployment.forward_deployed_engineer.name}
                      </span>
                    )}
                    <span className="text-gray-300">|</span>
                    <span>
                      {new Date(deployment.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <EditDeploymentButton
                    deployment={{
                      id: deployment.id,
                      client_name: deployment.client_name,
                      deployment_id: deployment.deployment_id,
                      jira_space: deployment.jira_space,
                      agent_designer_id: deployment.agent_designer_id,
                      forward_deployed_engineer_id: deployment.forward_deployed_engineer_id,
                    }}
                    agentDesigners={agentDesigners}
                    fdes={fdes}
                  />
                </div>
              </div>

              {/* UAT Sheets & Issue Trackers */}
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {/* UAT Sheets */}
                  {deployment.uat_sheets?.map((sheet: { id: string; name: string }) => (
                    <Link
                      key={sheet.id}
                      href={`/uat-sheets/${sheet.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {sheet.name}
                    </Link>
                  ))}

                  {/* Issue Trackers */}
                  {deployment.issue_trackers?.map((tracker: { id: string; name: string }) => (
                    <Link
                      key={tracker.id}
                      href={`/issue-trackers/${tracker.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-100 hover:border-rose-300 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {tracker.name}
                    </Link>
                  ))}

                  {/* Empty state */}
                  {(!deployment.uat_sheets || deployment.uat_sheets.length === 0) && 
                   (!deployment.issue_trackers || deployment.issue_trackers.length === 0) && (
                    <span className="text-sm text-gray-400 italic">
                      No UAT sheets or issue trackers yet
                    </span>
                  )}

                  {/* Quick add link */}
                  <Link
                    href={`/deployments/${deployment.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
