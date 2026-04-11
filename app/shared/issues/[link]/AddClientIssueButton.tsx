'use client'

import { useState } from 'react'
import { addIssue } from '@/app/actions/issue-actions'

interface Props {
  issueTrackerId: string
  shareableLink: string
}

export default function AddClientIssueButton({ issueTrackerId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.append('issue_tracker_id', issueTrackerId)
    formData.append('status', 'In Progress') // Client-reported issues start as In Progress

    try {
      const result = await addIssue(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      } else {
        setSuccess(true)
        setLoading(false)
        setTimeout(() => {
          form.reset()
          setIsOpen(false)
          setSuccess(false)
        }, 1500)
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Report an Issue
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-brand-dark">Report New Issue</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {success ? (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-brand-dark">Issue Reported Successfully!</p>
                <p className="text-sm text-gray-600 mt-2">Our team has been notified and will investigate.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="issue_name" className="block text-sm font-medium text-brand-dark mb-1.5">
                    Issue Summary <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="issue_name"
                    name="issue_name"
                    required
                    className="input-field"
                    placeholder="Brief description of the issue"
                  />
                </div>

                <div>
                  <label htmlFor="issue_description" className="block text-sm font-medium text-brand-dark mb-1.5">
                    Detailed Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="issue_description"
                    name="issue_description"
                    required
                    className="input-field min-h-[120px] resize"
                    placeholder="Please describe what happened, what you expected, and any other relevant details..."
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reported_by" className="block text-sm font-medium text-brand-dark mb-1.5">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="reported_by"
                      name="reported_by"
                      required
                      className="input-field"
                      placeholder="Your name"
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
                      <option value="High">High - Blocking critical functionality</option>
                      <option value="Medium">Medium - Impacting some functionality</option>
                      <option value="Low">Low - Minor issue</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="date_reported" className="block text-sm font-medium text-brand-dark mb-1.5">
                      When did this occur?
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
                      Time (if applicable)
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
                    Call Recording URL (Optional)
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
                    {loading ? 'Submitting...' : 'Report Issue'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
