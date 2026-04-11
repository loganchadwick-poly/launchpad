'use client'

import { useState } from 'react'
import { updateTestRound } from '@/app/actions/uat-test-cases'
import type { UATTestCase, UATTestRound } from '@/lib/types/database.types'

interface TestCaseWithRounds extends UATTestCase {
  rounds: UATTestRound[]
}

interface Props {
  testCase: TestCaseWithRounds
  index: number
  shareableLink: string
}

const resultOptions = [
  { value: 'As Designed - Perfect', label: 'As Designed (Perfect)', shortLabel: '✓ As Designed (Perfect)', color: 'border-green-500 bg-green-100 text-green-900', hoverColor: 'hover:bg-green-50' },
  { value: 'As Designed - Imperfect', label: 'As Designed (Imperfect)', shortLabel: '~ As Designed (Imperfect)', color: 'border-yellow-500 bg-yellow-100 text-yellow-900', hoverColor: 'hover:bg-yellow-50' },
  { value: 'Fail - Good UX', label: 'Fail (Good UX)', shortLabel: '✗ Fail (Good UX)', color: 'border-orange-500 bg-orange-100 text-orange-900', hoverColor: 'hover:bg-orange-50' },
  { value: 'Fail - Bad UX', label: 'Fail (Bad UX)', shortLabel: '✗ Fail (Bad UX)', color: 'border-red-500 bg-red-100 text-red-900', hoverColor: 'hover:bg-red-50' },
]

export default function ClientTestCaseRow({ testCase, index }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  // Get latest round for testing
  const latestRound = testCase.rounds[testCase.rounds.length - 1]
  const roundCount = testCase.rounds.length
  const isRetest = roundCount > 1

  // Handler for updating round fields
  async function handleRoundUpdate(field: string, value: string) {
    if (!latestRound) return
    
    setLoading(true)
    const formData = new FormData()
    formData.append('round_id', latestRound.id)
    formData.append('uat_sheet_id', testCase.uat_sheet_id)
    formData.append(field, value)
    
    await updateTestRound(formData)
    setLoading(false)
  }

  // Get result display info
  const resultOption = resultOptions.find(o => o.value === latestRound?.result)

  // Determine if this test case is "As Designed (Perfect)" - highlight in light green
  const isPerfect = latestRound?.result === 'As Designed - Perfect'
  
  return (
    <div className={`card overflow-hidden hover:shadow-md transition-shadow ${isPerfect ? 'bg-green-100' : 'bg-white'}`}>
      {/* Compact View */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
              {index + 1}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-medium text-brand-dark">
                {testCase.test_label}
              </h3>
              {isRetest && (
                <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                  Round {roundCount}
                </span>
              )}
            </div>
            {testCase.test_script && (
              <p className="text-sm text-gray-600 mb-2">{testCase.test_script}</p>
            )}
            
            <div className="flex items-center gap-3 flex-wrap">
              {resultOption ? (
                <span className={`inline-flex rounded border-2 px-3 py-1 text-sm font-medium ${resultOption.color}`}>
                  {resultOption.label}
                </span>
              ) : (
                <span className="text-sm text-gray-400">Not tested</span>
              )}
              {latestRound?.tester_name && (
                <span className="text-sm text-gray-500">by {latestRound.tester_name}</span>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex-shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              isExpanded
                ? 'border-brand-dark bg-brand-dark text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isExpanded ? 'Close' : 'Test'}
          </button>
        </div>
      </div>

      {/* Expanded Testing Interface */}
      {isExpanded && latestRound && (
        <div className="border-t border-gray-200 bg-gray-50 p-6">
          <div className="space-y-4 max-w-2xl">
            {/* Retest Notice */}
            {isRetest && (
              <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-sm font-medium text-purple-800">
                    Retest Round {roundCount} - The issue has been addressed. Please test again.
                  </p>
                </div>
              </div>
            )}

            {/* Your Name */}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1.5">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                defaultValue={latestRound.tester_name || ''}
                onBlur={(e) => handleRoundUpdate('tester_name', e.target.value)}
                className="input-field"
                placeholder="Enter your name..."
              />
            </div>

            {/* Call Recording URL */}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1.5">
                Call Recording URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                defaultValue={latestRound.call_link || ''}
                onBlur={(e) => handleRoundUpdate('call_link', e.target.value)}
                className="input-field"
                placeholder="Paste the call recording link..."
              />
              <p className="text-xs text-gray-500 mt-1">Paste the URL to the call recording for this test</p>
            </div>

            {/* Result Selection */}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1.5">
                Test Result <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {resultOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleRoundUpdate('result', option.value)}
                    disabled={loading}
                    className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                      latestRound.result === option.value
                        ? option.color
                        : `border-gray-300 bg-white text-gray-700 ${option.hoverColor}`
                    }`}
                  >
                    {option.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Testing Feedback */}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1.5">
                Testing Feedback
              </label>
              <textarea
                defaultValue={latestRound.comments || ''}
                onBlur={(e) => handleRoundUpdate('comments', e.target.value)}
                className="input-field min-h-[100px] resize"
                placeholder="For less than perfect results, describe what needs to be fixed..."
              />
            </div>

            {loading && (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </div>
            )}

            {/* Previous Round Context (for retests) */}
            {isRetest && testCase.rounds.length > 1 && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h4 className="text-sm font-medium text-brand-dark mb-2">Previous Test Results</h4>
                <div className="space-y-2">
                  {testCase.rounds.slice(0, -1).map((round) => {
                    const prevResult = resultOptions.find(o => o.value === round.result)
                    return (
                      <div key={round.id} className="text-sm text-gray-600">
                        <span className="font-medium">Round {round.round_number}:</span>{' '}
                        {prevResult ? (
                          <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${prevResult.color}`}>
                            {prevResult.label}
                          </span>
                        ) : 'Not tested'}{' '}
                        {round.tester_name && `by ${round.tester_name}`}
                        {round.comments && (
                          <p className="text-xs text-gray-500 mt-1 ml-4">&quot;{round.comments}&quot;</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
