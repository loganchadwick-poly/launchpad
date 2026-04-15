import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/getUser'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AddTestCaseButton from './AddTestCaseButton'
import AddRowButton from './AddRowButton'
import DraggableTestCaseTable from './DraggableTestCaseTable'
import CopyLinkButton from '@/app/components/CopyLinkButton'
import type { UATTestCase, UATTestRound } from '@/lib/types/database.types'

interface TestCaseWithRounds extends UATTestCase {
  rounds: UATTestRound[]
}

export default async function UATSheetPage({ params }: { params: Promise<{ id: string }> }) {
  await getUser() // Ensure authenticated
  const { id } = await params
  
  const supabase = await createClient()

  // Get UAT sheet with deployment info
  const { data: uatSheet } = await supabase
    .from('uat_sheets')
    .select(`
      *,
      deployment:deployment_id(
        id,
        client_name,
        jira_component
      )
    `)
    .eq('id', id)
    .single()

  if (!uatSheet) {
    redirect('/deployments')
  }

  // Get all test cases with their rounds
  let { data: testCases } = await supabase
    .from('uat_test_cases')
    .select(`
      *,
      rounds:uat_test_rounds(*)
    `)
    .eq('uat_sheet_id', id)
    .order('row_number', { ascending: true })

  // Fix: Create Round 1 for any test cases missing rounds (handles pre-migration data)
  const testCasesMissingRounds = (testCases || []).filter(tc => !tc.rounds || tc.rounds.length === 0)
  if (testCasesMissingRounds.length > 0) {
    const missingRounds = testCasesMissingRounds.map(tc => ({
      test_case_id: tc.id,
      round_number: 1,
      tester_name: '',
      call_link: '',
      comments: '',
    }))
    await supabase.from('uat_test_rounds').insert(missingRounds)
    
    // Re-fetch to get the newly created rounds
    const { data: refreshedTestCases } = await supabase
      .from('uat_test_cases')
      .select(`
        *,
        rounds:uat_test_rounds(*)
      `)
      .eq('uat_sheet_id', id)
      .order('row_number', { ascending: true })
    
    testCases = refreshedTestCases
  }

  // Sort rounds within each test case by round_number
  const testCasesWithSortedRounds: TestCaseWithRounds[] = (testCases || []).map(tc => ({
    ...tc,
    rounds: (tc.rounds || []).sort((a: UATTestRound, b: UATTestRound) => a.round_number - b.round_number)
  }))

  // Calculate stats based on LATEST round results
  const populatedTests = testCasesWithSortedRounds.filter(t => t.test_label && t.test_label.trim() !== '')
  const totalTests = populatedTests.length

  // Get latest result for each populated test
  const latestResults = populatedTests.map(t => {
    const latestRound = t.rounds[t.rounds.length - 1]
    return latestRound?.result || null
  }).filter(Boolean)

  const testedCount = latestResults.length
  const notTestedCount = totalTests - testedCount
  const perfectCount = latestResults.filter(r => r === 'As Designed - Perfect').length
  const imperfectCount = latestResults.filter(r => r === 'As Designed - Imperfect').length
  const failGoodUXCount = latestResults.filter(r => r === 'Fail - Good UX').length
  const failBadUXCount = latestResults.filter(r => r === 'Fail - Bad UX').length

  // Calculate percentages based on TOTAL test cases (not just tested)
  const pct = (count: number) => totalTests > 0 ? Math.round((count / totalTests) * 100) : 0

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <Link href="/deployments" className="hover:text-brand-dark">Deployments</Link>
          <span>/</span>
          <Link href={`/deployments/${uatSheet.deployment.id}`} className="hover:text-brand-dark">
            {uatSheet.deployment.client_name}
          </Link>
          <span>/</span>
          <span className="text-brand-dark">{uatSheet.name}</span>
        </div>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-brand-dark">{uatSheet.name}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {uatSheet.deployment.client_name} • {uatSheet.deployment.jira_component}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CopyLinkButton link={`/shared/uat/${uatSheet.shareable_link_token}`} label="Share with Client" />
            <AddTestCaseButton uatSheetId={id} />
          </div>
        </div>
      </div>

      {/* Client Link Info */}
      <div className="mb-6 card border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-brand-dark mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-brand-dark">Client Access</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Click &quot;Share with Client&quot; to copy the shareable link. Clients can access this UAT sheet without logging in.
            </p>
          </div>
        </div>
      </div>

      {/* Stats - Progress Overview */}
      <div className="mb-6 space-y-3">
        {/* Progress Row - Total, Tested, Not Tested */}
        <div className="flex flex-wrap gap-4">
          <div className="card border border-gray-200 bg-white px-5 py-3">
            <p className="text-2xl font-semibold text-brand-dark">{totalTests}</p>
            <p className="text-sm text-gray-600">Total Cases</p>
          </div>
          <div className="card border border-gray-200 bg-white px-5 py-3">
            <p className="text-2xl font-semibold text-brand-dark">{testedCount} <span className="text-base font-normal text-gray-500">of {totalTests}</span></p>
            <p className="text-sm text-gray-600 font-medium">Cases Tested</p>
          </div>
          <div className="card border border-gray-200 bg-white px-5 py-3">
            <p className="text-2xl font-semibold text-brand-dark">{notTestedCount} <span className="text-base font-normal text-gray-500">of {totalTests}</span></p>
            <p className="text-sm text-gray-600 font-medium">Not Tested</p>
          </div>
        </div>

        {/* Results Breakdown */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card border border-gray-200 bg-green-50 p-3">
            <p className="text-lg font-semibold text-brand-dark">{pct(perfectCount)}%</p>
            <p className="text-xs text-gray-700 font-medium">As Designed (Perfect)</p>
            <p className="text-[11px] text-gray-500 mt-1">{perfectCount} of {totalTests} tests</p>
          </div>
          <div className="card border border-gray-200 bg-yellow-50 p-3">
            <p className="text-lg font-semibold text-brand-dark">{pct(imperfectCount)}%</p>
            <p className="text-xs text-gray-700 font-medium">As Designed (Imperfect)</p>
            <p className="text-[11px] text-gray-500 mt-1">{imperfectCount} of {totalTests} tests</p>
          </div>
          <div className="card border border-gray-200 bg-orange-50 p-3">
            <p className="text-lg font-semibold text-brand-dark">{pct(failGoodUXCount)}%</p>
            <p className="text-xs text-gray-700 font-medium">Fail (Good UX)</p>
            <p className="text-[11px] text-gray-500 mt-1">{failGoodUXCount} of {totalTests} tests</p>
          </div>
          <div className="card border border-gray-200 bg-red-50 p-3">
            <p className="text-lg font-semibold text-brand-dark">{pct(failBadUXCount)}%</p>
            <p className="text-xs text-gray-700 font-medium">Fail (Bad UX)</p>
            <p className="text-[11px] text-gray-500 mt-1">{failBadUXCount} of {totalTests} tests</p>
          </div>
        </div>
      </div>

      {/* Test Cases Table - Spreadsheet Style with Drag & Drop */}
      {!testCasesWithSortedRounds || testCasesWithSortedRounds.length === 0 ? (
        <div className="card border border-gray-200 overflow-hidden">
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-medium text-gray-900">No test cases yet</h3>
            <p className="mt-2 text-sm text-gray-500">Add your first test case to start UAT testing</p>
          </div>
          {/* Add Row Button - even when empty */}
          <AddRowButton uatSheetId={id} />
        </div>
      ) : (
        <div className="card overflow-hidden border border-gray-200">
          {/* Spreadsheet tip */}
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 text-xs text-brand-dark">
            <span className="font-medium">Tip:</span> Drag rows onto each other to group related issues. Click any cell to edit. Use the round badge (R1, R2...) to view testing history.
          </div>
          <div className="overflow-x-auto">
            <DraggableTestCaseTable testCases={testCasesWithSortedRounds} uatSheetId={id} />
          </div>
          {/* Add Row Button - Spreadsheet style */}
          <AddRowButton uatSheetId={id} />
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 card border border-gray-200 bg-white p-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-medium text-brand-dark">Result Guide:</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-green-100 border border-green-300"></div>
                <span className="text-gray-700"><strong>As Designed (Perfect)</strong> - Desired outcome achieved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-yellow-100 border border-yellow-300"></div>
                <span className="text-gray-700"><strong>As Designed (Imperfect)</strong> - Minor issues</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-orange-100 border border-orange-300"></div>
                <span className="text-gray-700"><strong>Fail (Good UX)</strong> - Handled gracefully</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-red-100 border border-red-300"></div>
                <span className="text-gray-700"><strong>Fail (Bad UX)</strong> - Poor experience</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium text-brand-dark">Issue Grouping:</p>
            <div className="mt-2 space-y-1.5 text-gray-600">
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
                <span>Drag one row onto another to group related issues</span>
              </p>
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                </svg>
                <span>Grouped issues share a single JIRA ticket</span>
              </p>
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Click the unlink icon to remove a row from a group</span>
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500 border-t border-gray-200 pt-3">
          <strong>RTR</strong> = Ready To Retest. Check the box on less than perfect tests to create a new retest round.
        </p>
      </div>
    </div>
  )
}
