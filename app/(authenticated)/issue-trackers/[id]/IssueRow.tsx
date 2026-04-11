'use client'

import { useState } from 'react'
import { updateIssue, deleteIssue } from '@/app/actions/issue-actions'
import type { Issue } from '@/lib/types/database.types'

const priorityColors = {
  High: 'bg-red-100 border-red-300 text-red-900',
  Medium: 'bg-yellow-100 border-yellow-300 text-yellow-900',
  Low: 'bg-blue-100 border-blue-300 text-blue-900',
}

const statusColors = {
  'In Progress': 'bg-yellow-100 border-yellow-300 text-yellow-900',
  'Backlogged': 'bg-gray-100 border-gray-300 text-gray-900',
  'Resolved': 'bg-green-100 border-green-300 text-green-900',
  'More Info Needed': 'bg-orange-100 border-orange-300 text-orange-900',
  'Non-Actionable': 'bg-gray-100 border-gray-300 text-gray-700',
  'Accepted for Fix': 'bg-blue-100 border-blue-300 text-blue-900',
}

interface Props {
  issue: Issue
  issueTrackerId: string
}

export default function IssueRow({ issue, issueTrackerId }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleFieldUpdate(field: string, value: string) {
    setLoading(true)
    const formData = new FormData()
    formData.append('id', issue.id)
    formData.append('issue_tracker_id', issueTrackerId)
    formData.append(field, value)
    
    await updateIssue(formData)
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this issue?')) return
    
    setLoading(true)
    await deleteIssue(issue.id, issueTrackerId)
  }

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-left text-sm font-medium text-brand-dark hover:underline"
          >
            {issue.issue_name}
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{issue.reported_by}</td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {new Date(issue.date_reported).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${priorityColors[issue.priority]}`}>
            {issue.priority}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${statusColors[issue.status]}`}>
            {issue.status}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {issue.expected_fix_date 
            ? new Date(issue.expected_fix_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '-'
          }
        </td>
        <td className="px-4 py-3 text-sm">
          {issue.jira_ticket_id ? (
            <a href="#" className="text-blue-600 hover:underline">{issue.jira_ticket_id}</a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-4 py-6">
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-semibold text-brand-dark">Issue Details</h3>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Issue Description */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1.5">Issue Description</label>
                <textarea
                  defaultValue={issue.issue_description}
                  onBlur={(e) => handleFieldUpdate('issue_description', e.target.value)}
                  className="input-field min-h-[100px] resize"
                  placeholder="Describe the issue in detail..."
                />
              </div>

              {/* Reporter Info Row */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1.5">Reported By</label>
                  <input
                    type="text"
                    defaultValue={issue.reported_by}
                    onBlur={(e) => handleFieldUpdate('reported_by', e.target.value)}
                    className="input-field"
                    placeholder="Reporter name..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1.5">Date Reported</label>
                  <input
                    type="date"
                    defaultValue={issue.date_reported}
                    onBlur={(e) => handleFieldUpdate('date_reported', e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1.5">Time of Call</label>
                  <input
                    type="time"
                    defaultValue={issue.time_of_call}
                    onBlur={(e) => handleFieldUpdate('time_of_call', e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Call URL */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1.5">Call Recording URL</label>
                <input
                  type="url"
                  defaultValue={issue.call_url}
                  onBlur={(e) => handleFieldUpdate('call_url', e.target.value)}
                  className="input-field"
                  placeholder="https://..."
                />
              </div>

              {/* Priority, Status, Expected Fix Date */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1.5">Priority</label>
                  <select
                    defaultValue={issue.priority}
                    onChange={(e) => handleFieldUpdate('priority', e.target.value)}
                    className="input-field"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1.5">Status</label>
                  <select
                    defaultValue={issue.status}
                    onChange={(e) => handleFieldUpdate('status', e.target.value)}
                    className="input-field"
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Backlogged">Backlogged</option>
                    <option value="Resolved">Resolved</option>
                    <option value="More Info Needed">More Info Needed</option>
                    <option value="Non-Actionable">Non-Actionable</option>
                    <option value="Accepted for Fix">Accepted for Fix</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1.5">Expected Fix Date</label>
                  <input
                    type="date"
                    defaultValue={issue.expected_fix_date || ''}
                    onBlur={(e) => handleFieldUpdate('expected_fix_date', e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Issue URL (if external tracking) */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1.5">Issue URL (Optional)</label>
                <input
                  type="url"
                  defaultValue={issue.issue_url || ''}
                  onBlur={(e) => handleFieldUpdate('issue_url', e.target.value)}
                  className="input-field"
                  placeholder="External tracking URL..."
                />
              </div>

              {/* PolyAI Internal Notes */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1.5">PolyAI Internal Notes</label>
                <textarea
                  defaultValue={issue.polyai_notes}
                  onBlur={(e) => handleFieldUpdate('polyai_notes', e.target.value)}
                  className="input-field min-h-[80px] resize"
                  placeholder="Internal notes and resolution details..."
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
