'use client'

import { useState } from 'react'
import { addIssue } from '@/app/actions/issue-actions'

export default function AddIssueButton({ issueTrackerId }: { issueTrackerId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.append('issue_tracker_id', issueTrackerId)

    try {
      const result = await addIssue(formData)
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
        Add Issue
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-brand-dark">Add New Issue</h2>
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
                <label htmlFor="issue_name" className="block text-sm font-medium text-brand-dark mb-1.5">
                  Issue Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="issue_name"
                  name="issue_name"
                  required
                  className="input-field"
                  placeholder="e.g., Call routing failure, Audio quality issue"
                />
              </div>

              <div>
                <label htmlFor="issue_description" className="block text-sm font-medium text-brand-dark mb-1.5">
                  Issue Description
                </label>
                <textarea
                  id="issue_description"
                  name="issue_description"
                  className="input-field min-h-[100px]"
                  placeholder="Detailed description of the issue..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="reported_by" className="block text-sm font-medium text-brand-dark mb-1.5">
                    Reported By <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="reported_by"
                    name="reported_by"
                    required
                    className="input-field"
                    placeholder="Reporter name..."
                  />
                </div>
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-brand-dark mb-1.5">
                    Priority
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    defaultValue="Medium"
                    className="input-field"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="date_reported" className="block text-sm font-medium text-brand-dark mb-1.5">
                    Date Reported
                  </label>
                  <input
                    type="date"
                    id="date_reported"
                    name="date_reported"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="time_of_call" className="block text-sm font-medium text-brand-dark mb-1.5">
                    Time of Call
                  </label>
                  <input
                    type="time"
                    id="time_of_call"
                    name="time_of_call"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="call_url" className="block text-sm font-medium text-brand-dark mb-1.5">
                  Call Recording URL
                </label>
                <input
                  type="url"
                  id="call_url"
                  name="call_url"
                  className="input-field"
                  placeholder="https://..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsOpen(false)} className="btn-outline flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                  {loading ? 'Adding...' : 'Add Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
