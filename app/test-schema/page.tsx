import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TestSchemaPage() {
  const supabase = await createClient()
  
  // Test each table
  const tables = [
    'users',
    'deployments',
    'uat_sheets',
    'uat_test_cases',
    'issue_trackers',
    'issues',
    'pending_jira_tickets'
  ]
  
  const results = await Promise.all(
    tables.map(async (table) => {
      try {
        const { error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
        
        return {
          table,
          exists: !error || error.code !== '42P01',
          error: error?.message,
          count: count || 0
        }
      } catch (e: unknown) {
        return {
          table,
          exists: false,
          error: e instanceof Error ? e.message : 'Unknown error',
          count: 0
        }
      }
    })
  )
  
  const allTablesExist = results.every(r => r.exists)
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Database Schema Test</h1>
          <p className="mt-2 text-gray-600">
            Checking if all tables were created successfully...
          </p>
        </div>

        {/* Overall Status */}
        <div className={`mb-6 rounded-2xl border-2 p-6 ${
          allTablesExist 
            ? 'border-green-200 bg-green-50' 
            : 'border-yellow-200 bg-yellow-50'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
              allTablesExist ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {allTablesExist ? (
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className={`text-2xl font-semibold ${
                allTablesExist ? 'text-green-900' : 'text-yellow-900'
              }`}>
                {allTablesExist 
                  ? '✅ All Tables Created Successfully!' 
                  : '⚠️ Some Tables Missing'}
              </h2>
              <p className={`text-sm ${
                allTablesExist ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {allTablesExist
                  ? 'Your database schema is ready to use!'
                  : 'Please run the missing migrations in Supabase'}
              </p>
            </div>
          </div>
        </div>

        {/* Table Status Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((result) => (
            <div
              key={result.table}
              className={`rounded-xl border-2 bg-white p-6 shadow-sm ${
                result.exists 
                  ? 'border-green-200' 
                  : 'border-red-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-mono text-lg font-semibold text-gray-900">
                    {result.table}
                  </h3>
                  <p className={`mt-1 text-sm ${
                    result.exists ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {result.exists ? '✓ Exists' : '✗ Not found'}
                  </p>
                  {result.exists && (
                    <p className="mt-2 text-xs text-gray-500">
                      {result.count} rows
                    </p>
                  )}
                  {!result.exists && result.error && (
                    <p className="mt-2 text-xs text-red-600">
                      {result.error}
                    </p>
                  )}
                </div>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  result.exists ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {result.exists ? (
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        {!allTablesExist && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">
            <h3 className="text-xl font-semibold text-gray-900">How to Fix</h3>
            <ol className="mt-4 space-y-2 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="font-semibold text-blue-600">1.</span>
                <span>Go to your <a href="https://supabase.com/dashboard/project/rpabsxlpzamjoghthplx" target="_blank" className="text-blue-600 underline">Supabase Dashboard</a></span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-blue-600">2.</span>
                <span>Click <strong>SQL Editor</strong> in the sidebar</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-blue-600">3.</span>
                <span>Run the migrations in <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs">supabase/migrations/</code></span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-blue-600">4.</span>
                <span>Refresh this page to verify</span>
              </li>
            </ol>
            <p className="mt-4 text-sm text-gray-600">
              See <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs">supabase/MIGRATION_GUIDE.md</code> for detailed instructions.
            </p>
          </div>
        )}

        {allTablesExist && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">
            <h3 className="text-xl font-semibold text-gray-900">🎉 Schema is Ready!</h3>
            <p className="mt-2 text-gray-600">
              Your database is fully set up and ready to use. Next steps:
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>All 7 tables created</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Row Level Security enabled</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Automatic JIRA ticket triggers configured</span>
              </li>
            </ul>
            <div className="mt-6 flex gap-4">
              <Link
                href="/dashboard"
                className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
              >
                Go to Dashboard →
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition-all hover:border-gray-400 hover:bg-gray-50"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
