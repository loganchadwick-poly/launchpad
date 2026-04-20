import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/getUser'
import Link from 'next/link'

export default async function UATSheetsPage() {
  await getUser() // Ensure authenticated
  const supabase = await createClient()

  // Get all UAT sheets with deployment info and test case count
  const { data: sheets } = await supabase
    .from('uat_sheets')
    .select(`
      *,
      deployment:deployment_id(
        id,
        client_name,
        jira_component
      ),
      uat_test_cases(id)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between opacity-0 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">UAT Sheets</h1>
          <p className="text-sm text-gray-600">
            Review and manage UAT test sheets across all deployments
          </p>
        </div>
      </div>

      {/* UAT Sheets List */}
      {!sheets || sheets.length === 0 ? (
        <div className="card p-16 text-center opacity-0 animate-fade-in stagger-1">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="mt-6 text-lg font-semibold text-brand-dark">No UAT sheets yet</h3>
          <p className="mt-2 text-gray-500 max-w-sm mx-auto">
            UAT sheets are created from within a deployment. Go to a deployment to create one or import from CSV/XLSX.
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
          {sheets.map((sheet) => {
            const caseCount = sheet.uat_test_cases?.length || 0
            return (
              <Link
                key={sheet.id}
                href={`/uat-sheets/${sheet.id}`}
                className="card-hover block overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                      <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-brand-dark">
                        {sheet.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{sheet.deployment?.client_name}</span>
                        {sheet.deployment?.jira_component && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="font-mono text-xs">{sheet.deployment.jira_component}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {caseCount > 0 && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gray-200 px-2 text-xs font-bold text-gray-700">
                        {caseCount}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(sheet.created_at).toLocaleDateString('en-US', {
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
