'use client'

import { useState } from 'react'
import { markTicketAsExported, deleteTicket } from '@/app/actions/jira-tickets'
import type { PendingJiraTicket, Deployment } from '@/lib/types/database.types'

const ticketTypeColors: Record<string, string> = {
  'UAT Failure': 'bg-gray-100 border-gray-300 text-gray-800',
  'Issue Tracker': 'bg-gray-100 border-gray-300 text-gray-800',
  'Retest Failure': 'bg-gray-100 border-gray-300 text-gray-800',
  'UAT': 'bg-gray-100 border-gray-300 text-gray-800',
  'Hypercare': 'bg-gray-100 border-gray-300 text-gray-800',
  'Retest': 'bg-gray-100 border-gray-300 text-gray-800',
}

interface Props {
  ticket: PendingJiraTicket & { deployment?: Deployment }
}

export default function TicketCard({ ticket }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(ticket.description)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleMarkExported() {
    if (!confirm('Mark this ticket as exported to JIRA?')) return
    
    setLoading(true)
    await markTicketAsExported(ticket.id)
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this ticket? This action cannot be undone.')) return
    
    setLoading(true)
    await deleteTicket(ticket.id)
  }

  return (
    <div className={`card overflow-hidden transition-shadow ${
      ticket.exported ? 'bg-gray-50 opacity-75' : 'bg-white hover:shadow-lg'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex rounded border-2 px-3 py-1 text-xs font-bold ${ticketTypeColors[ticket.ticket_type]}`}>
                {ticket.ticket_type}
              </span>
              {ticket.exported && (
                <span className="inline-flex items-center gap-1.5 rounded bg-green-100 border border-green-300 px-2 py-1 text-xs font-medium text-green-800">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Exported
                </span>
              )}
            </div>
            
            <h3 className="text-lg font-semibold text-brand-dark mb-1">
              {ticket.summary}
            </h3>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {ticket.deployment?.client_name || 'Unknown'}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {ticket.deployment?.jira_component || ticket.space}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(ticket.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {isExpanded ? 'Hide' : 'View'} Details
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-brand-dark mb-2 flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Formatted Ticket Text
            </h4>
            <div className="relative">
              <pre className="rounded-lg border border-gray-300 bg-white p-4 text-sm text-gray-800 font-mono overflow-x-auto whitespace-pre-wrap">
{ticket.description}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            {!ticket.exported ? (
              <>
                <button
                  onClick={handleMarkExported}
                  disabled={loading}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {loading ? 'Marking...' : 'Mark as Exported to JIRA'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="btn-outline text-red-600 border-red-300 hover:bg-red-50"
                >
                  Delete
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Exported to JIRA
              </div>
            )}
          </div>

          {/* Instructions */}
          {!ticket.exported && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-900">
                <strong>Instructions:</strong> Copy the ticket text above, create a new JIRA ticket in the <strong>{ticket.deployment?.jira_component || ticket.space}</strong> project,
                paste the text, and click &quot;Mark as Exported&quot; when done.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
