import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TestConnectionPage() {
  let connectionStatus = {
    success: false,
    message: '',
    timestamp: new Date().toISOString()
  }

  try {
    const supabase = await createClient()
    
    // Try to query the database (this will work even with no tables)
    const { error } = await supabase
      .from('_test')
      .select('*')
      .limit(1)

    // Even if the table doesn't exist, a successful connection will return a specific error
    if (error) {
      // Check if it's a "table doesn't exist" error (which means connection works!)
      if (
        error.message.includes('does not exist') || 
        error.code === '42P01' ||
        error.message.includes('schema cache') ||
        error.message.includes('Could not find the table')
      ) {
        connectionStatus = {
          success: true,
          message: 'Connection successful! Database is ready for tables.',
          timestamp: new Date().toISOString()
        }
      } else {
        connectionStatus = {
          success: false,
          message: `Connection error: ${error.message}`,
          timestamp: new Date().toISOString()
        }
      }
    } else {
      connectionStatus = {
        success: true,
        message: 'Connection successful! Database is operational.',
        timestamp: new Date().toISOString()
      }
    }
  } catch (error: unknown) {
    connectionStatus = {
      success: false,
      message: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Supabase Connection Test</h1>
          <p className="mt-2 text-gray-600">
            Testing connection to your Supabase database...
          </p>
        </div>

        <div className="rounded-2xl border-2 bg-white p-8 shadow-lg">
          {/* Status Indicator */}
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full ${
                connectionStatus.success
                  ? 'bg-green-100'
                  : 'bg-red-100'
              }`}
            >
              {connectionStatus.success ? (
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
            <div>
              <h2
                className={`text-2xl font-semibold ${
                  connectionStatus.success ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {connectionStatus.success ? 'Connected!' : 'Connection Failed'}
              </h2>
              <p className="text-sm text-gray-500">
                {connectionStatus.timestamp}
              </p>
            </div>
          </div>

          {/* Message */}
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <p className="text-gray-700">{connectionStatus.message}</p>
          </div>

          {/* Environment Info */}
          <div className="mt-6 space-y-2 border-t pt-6">
            <h3 className="font-semibold text-gray-900">Configuration</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Supabase URL:</span>
                <span className="font-mono text-gray-900">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Anon Key:</span>
                <span className="font-mono text-gray-900">
                  {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20)}...
                </span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          {connectionStatus.success && (
            <div className="mt-6 rounded-lg bg-blue-50 p-4">
              <h3 className="font-semibold text-blue-900">✅ Ready to Continue!</h3>
              <p className="mt-2 text-sm text-blue-700">
                Your Supabase connection is working perfectly. You&apos;re ready to proceed to
                <strong> Step 2: Database Schema</strong> where we&apos;ll create all the tables.
              </p>
            </div>
          )}

          {!connectionStatus.success && (
            <div className="mt-6 rounded-lg bg-red-50 p-4">
              <h3 className="font-semibold text-red-900">Troubleshooting</h3>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                <li>• Check that your Supabase project is fully provisioned</li>
                <li>• Verify the URL and anon key in .env.local are correct</li>
                <li>• Make sure there are no extra spaces in the values</li>
                <li>• Try restarting the dev server (Ctrl+C, then npm run dev)</li>
              </ul>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition-all hover:border-gray-400 hover:bg-gray-50"
          >
            ← Back to Home
          </Link>
          {connectionStatus.success && (
            <a
              href="https://supabase.com/dashboard/project/rpabsxlpzamjoghthplx"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
            >
              Open Supabase Dashboard →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
