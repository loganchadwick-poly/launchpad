'use client'

import { useState } from 'react'
import { addTestCase } from '@/app/actions/uat-test-cases'

export default function AddTestCaseButton({ uatSheetId }: { uatSheetId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.append('uat_sheet_id', uatSheetId)

    try {
      const result = await addTestCase(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      } else {
        setLoading(false)
        form.reset()
        setIsOpen(false)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn-primary inline-flex items-center gap-2">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Test Case
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-brand-dark">Add Test Case</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="test_label" className="block text-sm font-medium text-brand-dark mb-1.5">
                  Test Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="test_label"
                  name="test_label"
                  required
                  className="input-field"
                  placeholder="e.g., User Login Flow, Payment Processing"
                />
                <p className="mt-1 text-xs text-gray-500">A short, descriptive name for this test case</p>
              </div>

              <div>
                <label htmlFor="test_script" className="block text-sm font-medium text-brand-dark mb-1.5">
                  Test Script <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  id="test_script"
                  name="test_script"
                  className="input-field min-h-[100px]"
                  placeholder="Enter detailed test steps..."
                />
                <p className="mt-1 text-xs text-gray-500">Detailed steps or instructions for running this test</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsOpen(false)} className="btn-outline flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                  {loading ? 'Adding...' : 'Add Test Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
