import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientTestCaseRow from './ClientTestCaseRow'
import type { UATTestCase, UATTestRound } from '@/lib/types/database.types'

interface TestCaseWithRounds extends UATTestCase {
  rounds: UATTestRound[]
}

export default async function SharedUATPage({ params }: { params: Promise<{ link: string }> }) {
  const { link } = await params
  const supabase = await createClient()

  // Get UAT sheet by shareable link (public access)
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
    .eq('shareable_link_token', link)
    .single()

  if (!uatSheet) {
    notFound()
  }

  // Get all test cases with rounds
  const { data: testCases } = await supabase
    .from('uat_test_cases')
    .select(`
      *,
      rounds:uat_test_rounds(*)
    `)
    .eq('uat_sheet_id', uatSheet.id)
    .order('row_number', { ascending: true })

  // Sort rounds and filter to populated tests
  const testCasesWithSortedRounds: TestCaseWithRounds[] = (testCases || [])
    .map(tc => ({
      ...tc,
      rounds: (tc.rounds || []).sort((a: UATTestRound, b: UATTestRound) => a.round_number - b.round_number)
    }))
    .filter(tc => tc.test_label && tc.test_label.trim() !== '')

  // Calculate stats based on latest round
  const totalTests = testCasesWithSortedRounds.length
  const latestResults = testCasesWithSortedRounds.map(t => {
    const latestRound = t.rounds[t.rounds.length - 1]
    return latestRound?.result || null
  })
  
  const testedCount = latestResults.filter(Boolean).length
  const passingCount = latestResults.filter(r => r && !r.includes('Fail')).length
  const failingCount = latestResults.filter(r => r?.includes('Fail')).length
  const pendingCount = totalTests - testedCount
  const pct = (count: number) => totalTests > 0 ? Math.round((count / totalTests) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F5F5F5]">

      {/* Header Bar */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-brand-lime/20">
              <svg className="h-7 w-7 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-brand-dark tracking-tight">{uatSheet.name}</h1>
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <span className="font-medium text-brand-dark">{uatSheet.deployment.client_name}</span>
                <span className="text-gray-400">•</span>
                <span>UAT Testing</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Message */}
        <div className="mb-8 card border border-gray-200 bg-white p-8 opacity-0 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-lime/20 flex-shrink-0">
              <svg className="h-6 w-6 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-dark mb-2">Welcome to UAT Testing</h2>
              <p className="text-gray-600 mb-5 leading-relaxed">
                Please test each scenario below and record your results. Enter your name, 
                paste the call recording link, select the result, and leave your testing feedback. 
                <span className="font-medium text-brand-dark"> For any less than perfect results, please describe what needs to be fixed.</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800 font-medium text-sm border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  As Designed (Perfect)
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 font-medium text-sm border border-amber-200">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  As Designed (Imperfect)
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1.5 text-orange-800 font-medium text-sm border border-orange-200">
                  <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                  Fail (Good UX)
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1.5 text-rose-800 font-medium text-sm border border-rose-200">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  Fail (Bad UX)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 space-y-4 opacity-0 animate-fade-in stagger-1">
          {/* Progress Row */}
          <div className="flex flex-wrap gap-4">
            <div className="card bg-white p-5 border border-gray-200">
              <p className="text-3xl font-bold text-brand-dark">{totalTests}</p>
              <p className="text-sm font-medium text-gray-600">Total Cases</p>
            </div>
            <div className="card bg-white p-5 border border-gray-200">
              <p className="text-3xl font-bold text-brand-dark">{testedCount} <span className="text-lg font-normal text-gray-500">of {totalTests}</span></p>
              <p className="text-sm font-medium text-gray-600">Cases Tested</p>
            </div>
            <div className="card bg-white p-5 border border-gray-200">
              <p className="text-3xl font-bold text-brand-dark">{pendingCount} <span className="text-lg font-normal text-gray-500">of {totalTests}</span></p>
              <p className="text-sm font-medium text-gray-600">Not Tested</p>
            </div>
          </div>
          
          {/* Results Breakdown */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card bg-emerald-50 p-4 border border-gray-200">
              <p className="text-2xl font-bold text-brand-dark">{pct(passingCount)}%</p>
              <p className="text-xs font-medium text-gray-700">Passing</p>
              <p className="text-[11px] text-gray-500 mt-1">{passingCount} of {totalTests} tests</p>
            </div>
            <div className="card bg-rose-50 p-4 border border-gray-200">
              <p className="text-2xl font-bold text-brand-dark">{pct(failingCount)}%</p>
              <p className="text-xs font-medium text-gray-700">Less Than Perfect</p>
              <p className="text-[11px] text-gray-500 mt-1">{failingCount} of {totalTests} tests</p>
            </div>
          </div>
        </div>

        {/* Test Cases */}
        {testCasesWithSortedRounds.length === 0 ? (
          <div className="card p-16 text-center bg-white opacity-0 animate-fade-in stagger-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="mt-6 text-lg font-semibold text-brand-dark">No test cases yet</h3>
            <p className="mt-2 text-gray-500">Your team will add test cases for you to complete</p>
          </div>
        ) : (
          <div className="space-y-4 opacity-0 animate-fade-in stagger-2">
            {testCasesWithSortedRounds.map((testCase, index) => (
              <ClientTestCaseRow 
                key={testCase.id} 
                testCase={testCase} 
                index={index}
                shareableLink={link}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 opacity-0 animate-fade-in stagger-3">
          <p>Powered by <span className="font-semibold text-brand-dark">PolyAI LaunchPad</span></p>
        </div>
      </div>
    </div>
  )
}
