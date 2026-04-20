import { getDeployment } from '@/app/actions/deployments'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/getUser'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CreateUATSheetButton from './CreateUATSheetButton'
import CreateAndImportUATSheetButton from './CreateAndImportUATSheetButton'
import CreateIssueTrackerButton from './CreateIssueTrackerButton'
import EditDeploymentButton from './EditDeploymentButton'
import DeleteUATSheetButton from './DeleteUATSheetButton'

export default async function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await getUser() // Ensure authenticated
  const { id } = await params
  
  const deployment = await getDeployment(id)
  
  if (!deployment) {
    redirect('/deployments')
  }

  const supabase = await createClient()

  // Get UAT sheets for this deployment
  const { data: uatSheets } = await supabase
    .from('uat_sheets')
    .select('*')
    .eq('deployment_id', id)
    .order('created_at', { ascending: false })

  // Get issue trackers for this deployment
  const { data: issueTrackers } = await supabase
    .from('issue_trackers')
    .select('*')
    .eq('deployment_id', id)
    .order('created_at', { ascending: false })

  // Get team members for edit dropdown
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, role')
    .order('name')

  const agentDesigners = (users || []).filter(u => u.role === 'AD')
  const fdes = (users || []).filter(u => u.role === 'FDE')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <Link href="/deployments" className="hover:text-brand-dark">
            Deployments
          </Link>
          <span>/</span>
          <span className="text-brand-dark">{deployment.client_name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-brand-dark">{deployment.client_name}</h1>
            <p className="mt-1 text-sm text-gray-600">
              JIRA Component: {deployment.jira_component}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EditDeploymentButton 
              deployment={deployment}
              agentDesigners={agentDesigners}
              fdes={fdes}
            />
          </div>
        </div>
      </div>

      {/* Team Info */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-5 w-5 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Agent Designer</p>
              <p className="text-sm font-semibold text-brand-dark">
                {deployment.agent_designer?.name || 'Not assigned'}
              </p>
              {deployment.agent_designer?.email && (
                <p className="text-xs text-gray-500">{deployment.agent_designer.email}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-5 w-5 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Forward Deployed Engineer</p>
              <p className="text-sm font-semibold text-brand-dark">
                {deployment.forward_deployed_engineer?.name || 'Not assigned'}
              </p>
              {deployment.forward_deployed_engineer?.email && (
                <p className="text-xs text-gray-500">{deployment.forward_deployed_engineer.email}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* UAT Sheets Section */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-brand-dark">UAT Sheets</h2>
          <div className="flex items-center gap-2">
            <CreateAndImportUATSheetButton deploymentId={id} />
            <CreateUATSheetButton deploymentId={id} />
          </div>
        </div>

        {!uatSheets || uatSheets.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-gray-600">No UAT sheets yet</p>
            <p className="mt-1 text-xs text-gray-500">Create your first UAT sheet to start testing</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uatSheets.map((sheet) => (
              <div key={sheet.id} className="card-hover p-6 group relative">
                <Link href={`/uat-sheets/${sheet.id}`} className="block">
                  <div className="flex items-start justify-between pr-8">
                    <h3 className="text-lg font-semibold text-brand-dark group-hover:text-dark-500">
                      {sheet.name}
                    </h3>
                    <svg className="h-5 w-5 text-gray-400 group-hover:text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Created {new Date(sheet.created_at).toLocaleDateString()}
                  </p>
                </Link>
                <div className="absolute top-4 right-4">
                  <DeleteUATSheetButton 
                    sheetId={sheet.id} 
                    sheetName={sheet.name} 
                    deploymentId={id} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue Trackers Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-brand-dark">Issue Trackers</h2>
          <CreateIssueTrackerButton deploymentId={id} />
        </div>

        {!issueTrackers || issueTrackers.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-gray-600">No issue trackers yet</p>
            <p className="mt-1 text-xs text-gray-500">Create an issue tracker for hypercare support</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {issueTrackers.map((tracker) => (
              <Link
                key={tracker.id}
                href={`/issue-trackers/${tracker.id}`}
                className="card-hover p-6 group"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-brand-dark group-hover:text-dark-500">
                    {tracker.name}
                  </h3>
                  <svg className="h-5 w-5 text-gray-400 group-hover:text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Created {new Date(tracker.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
