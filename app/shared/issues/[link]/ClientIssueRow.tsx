'use client'

import { useState } from 'react'
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
  shareableLink: string
}

export default function ClientIssueRow({ issue }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="card bg-white overflow-hidden hover:shadow-md transition-shadow">
      {/* Compact View */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              issue.priority === 'High' ? 'bg-red-100' : 
              issue.priority === 'Medium' ? 'bg-yellow-100' : 'bg-blue-100'
            }`}>
              <svg className={`h-5 w-5 ${
                issue.priority === 'High' ? 'text-red-600' : 
                issue.priority === 'Medium' ? 'text-yellow-600' : 'text-blue-600'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-medium text-brand-dark mb-1">
              {issue.issue_name}
            </h3>
            {issue.issue_description && (
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{issue.issue_description}</p>
            )}
            
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${priorityColors[issue.priority]}`}>
                {issue.priority}
              </span>
              <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${statusColors[issue.status]}`}>
                {issue.status}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(issue.date_reported).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              {issue.expected_fix_date && (
                <span className="text-xs text-gray-500">
                  Fix by: {new Date(issue.expected_fix_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {isExpanded ? 'Close' : 'View Details'}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-6">
          <div className="space-y-4 max-w-2xl">
            <div>
              <h4 className="text-sm font-medium text-brand-dark mb-1.5">Issue Description</h4>
              <p className="text-sm text-gray-700">{issue.issue_description || 'No description provided.'}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-brand-dark mb-1.5">Reported By</h4>
                <p className="text-sm text-gray-700">{issue.reported_by}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-brand-dark mb-1.5">Time of Call</h4>
                <p className="text-sm text-gray-700">{issue.time_of_call || 'N/A'}</p>
              </div>
            </div>

            {issue.call_url && (
              <div>
                <h4 className="text-sm font-medium text-brand-dark mb-1.5">Call Recording</h4>
                <a 
                  href={issue.call_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View Recording →
                </a>
              </div>
            )}

            {issue.jira_ticket_id && (
              <div>
                <h4 className="text-sm font-medium text-brand-dark mb-1.5">JIRA Ticket</h4>
                <p className="text-sm font-mono text-gray-700">{issue.jira_ticket_id}</p>
              </div>
            )}

            {issue.status === 'Resolved' && (
              <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-medium text-green-900">
                    This issue has been resolved
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
