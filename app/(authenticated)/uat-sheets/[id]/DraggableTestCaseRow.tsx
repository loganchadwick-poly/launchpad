'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateTestCase, updateTestRound, createNewRound, deleteTestCase } from '@/app/actions/uat-test-cases'
import { ungroupUATRow } from '@/app/actions/grouping'
import type { UATTestCase, UATTestRound } from '@/lib/types/database.types'

const resultOptions = [
  { value: '', label: '-', color: 'bg-gray-50 text-gray-400' },
  { value: 'As Designed - Perfect', label: 'As Designed (Perfect)', color: 'bg-green-100 text-green-800' },
  { value: 'As Designed - Imperfect', label: 'As Designed (Imperfect)', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Fail - Good UX', label: 'Fail (Good UX)', color: 'bg-orange-100 text-orange-800' },
  { value: 'Fail - Bad UX', label: 'Fail (Bad UX)', color: 'bg-red-100 text-red-800' },
]

interface TestCaseWithRounds extends UATTestCase {
  rounds: UATTestRound[]
}

interface Props {
  testCase: TestCaseWithRounds
  uatSheetId: string
  isChild: boolean
  isParent: boolean
  dropState: 'dragging' | 'over' | null
  showGroupCell?: boolean
  groupCellContent?: React.ReactNode
  groupRowSpan?: number
}

// Editable cell component for text inputs
function EditableCell({ 
  value, 
  onSave, 
  placeholder = '',
  type = 'text',
  className = '',
  disabled = false
}: { 
  value: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
  type?: 'text' | 'textarea' | 'url'
  className?: string
  disabled?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [currentValue, setCurrentValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setCurrentValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  async function handleBlur() {
    setIsEditing(false)
    if (currentValue !== value) {
      setSaving(true)
      await onSave(currentValue)
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setCurrentValue(value)
      setIsEditing(false)
    }
  }

  if (disabled) {
    return (
      <div className={`rounded px-2 py-1 text-sm bg-gray-100 text-gray-400 min-h-[28px] cursor-not-allowed ${className}`}>
        <span className="text-gray-300">—</span>
      </div>
    )
  }

  if (isEditing) {
    if (type === 'textarea') {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize min-h-[80px]"
          rows={3}
        />
      )
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-text rounded px-2 py-1 text-sm hover:bg-gray-100 min-h-[28px] ${saving ? 'opacity-50' : ''} ${className}`}
    >
      {currentValue || <span className="text-gray-400">{placeholder}</span>}
    </div>
  )
}

// Dropdown cell for result selection
function ResultDropdown({
  value,
  onSave,
  disabled = false
}: {
  value: string | null
  onSave: (value: string) => Promise<void>
  disabled?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const currentOption = resultOptions.find(o => o.value === value) || resultOptions[0]

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    await onSave(e.target.value)
    setSaving(false)
  }

  if (disabled) {
    return (
      <div className="w-full rounded px-2 py-1 text-xs font-medium bg-gray-100 text-gray-300 cursor-not-allowed">
        —
      </div>
    )
  }

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={saving}
      className={`w-full rounded border-0 px-2 py-1 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-400 ${currentOption.color} ${saving ? 'opacity-50' : ''}`}
    >
      {resultOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default function DraggableTestCaseRow({ 
  testCase, 
  uatSheetId, 
  isChild, 
  isParent,
  dropState,
  showGroupCell = true,
  groupCellContent,
  groupRowSpan
}: Props) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [creatingRound, setCreatingRound] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: testCase.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Get latest round
  const latestRound = testCase.rounds[testCase.rounds.length - 1]
  const roundCount = testCase.rounds.length
  const hasHistory = roundCount > 1

  // Determine if we have a round with data to edit
  const hasActiveRound = !!latestRound

  // Handler for test case field updates
  async function handleTestCaseUpdate(field: string, value: string) {
    const formData = new FormData()
    formData.append('id', testCase.id)
    formData.append('uat_sheet_id', uatSheetId)
    formData.append(field, value)
    await updateTestCase(formData)
  }

  // Handler for round field updates
  async function handleRoundUpdate(roundId: string, field: string, value: string) {
    if (!roundId) {
      console.error('handleRoundUpdate called without roundId')
      return
    }
    const formData = new FormData()
    formData.append('round_id', roundId)
    formData.append('uat_sheet_id', uatSheetId)
    formData.append(field, value)
    const result = await updateTestRound(formData)
    if (result?.error) {
      console.error('Failed to update round:', result.error)
    }
  }

  // Handler for RTR checkbox
  async function handleRTRChange(checked: boolean) {
    if (!checked) return
    
    const canRetest = latestRound?.result && latestRound.result !== 'As Designed - Perfect'
    if (!canRetest) {
      alert('RTR can only be checked for test cases that are not "As Designed - Perfect".')
      return
    }
    
    setCreatingRound(true)
    await createNewRound(testCase.id, uatSheetId)
    setCreatingRound(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this test case and all its testing rounds?')) return
    setDeleting(true)
    await deleteTestCase(testCase.id, uatSheetId)
  }

  async function handleUngroup() {
    await ungroupUATRow(testCase.id, uatSheetId)
  }

  // Determine row background based on latest result and group status
  const getRowBg = () => {
    if (dropState === 'over') return 'bg-blue-100 ring-2 ring-blue-400 ring-inset'
    if (isDragging) return 'opacity-50 bg-gray-200'
    
    // Group styling
    if (isChild) return 'bg-blue-50/30'
    if (isParent) return 'bg-blue-50/50'
    
    const result = latestRound?.result
    if (!result) return ''
    if (result.includes('Perfect')) return 'bg-green-100'
    if (result.includes('Imperfect')) return 'bg-yellow-50/50'
    if (result.includes('Good UX')) return 'bg-orange-50/50'
    if (result.includes('Bad UX')) return 'bg-red-50/50'
    return ''
  }

  const canTriggerRetest = !!(latestRound?.result && latestRound.result !== 'As Designed - Perfect')
  const isAwaitingRetest = !!(latestRound && !latestRound.result && roundCount > 1)

  // Border styling for groups
  const groupBorderStyle = (isChild || isParent) 
    ? 'border-l-4 border-l-blue-400' 
    : ''

  return (
    <>
      <tr 
        ref={setNodeRef}
        style={style}
        className={`border-b border-gray-100 hover:bg-gray-50/50 ${getRowBg()} ${deleting ? 'opacity-50' : ''} ${groupBorderStyle}`}
      >
        {/* Issue Group Cell - only show for first row or use rowSpan */}
        {showGroupCell && (
          <td 
            className={`px-2 py-1 border-r border-gray-200 align-top ${(isChild || isParent) ? 'bg-blue-50/80' : ''}`}
            rowSpan={groupRowSpan}
          >
            {groupCellContent || (
              <div className="flex items-center justify-center h-full">
                {/* Drag handle for standalone rows */}
                <div 
                  {...attributes} 
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
                  title="Drag to group with another row"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              </div>
            )}
          </td>
        )}

        {/* Row Number */}
        <td className="w-12 px-2 py-1 text-center text-xs font-medium text-gray-500 border-r border-gray-100">
          <div className="flex items-center justify-center gap-1">
            {/* Drag handle for grouped rows */}
            {!showGroupCell && (
              <div 
                {...attributes} 
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-0.5 text-gray-400 hover:text-gray-600"
                title="Drag to reorder or ungroup"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>
            )}
            <span>{testCase.row_number}</span>
          </div>
        </td>

        {/* Test Label */}
        <td className="px-1 py-1 border-r border-gray-100 min-w-[180px]">
          <EditableCell
            value={testCase.test_label}
            onSave={(v) => handleTestCaseUpdate('test_label', v)}
            placeholder="Test label..."
          />
        </td>

        {/* Test Script */}
        <td className="px-1 py-1 border-r border-gray-100 min-w-[200px] max-w-[300px]">
          <EditableCell
            value={testCase.test_script}
            onSave={(v) => handleTestCaseUpdate('test_script', v)}
            placeholder="Test script..."
            type="textarea"
            className="line-clamp-2"
          />
        </td>

        {/* Round Badge */}
        <td className="px-1 py-1 border-r border-gray-100 w-[70px]">
          <button
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              hasHistory 
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                : 'bg-gray-100 text-gray-600'
            } ${isAwaitingRetest ? 'ring-2 ring-gray-400 ring-offset-1' : ''}`}
            title={hasHistory ? 'Click to view history' : 'Initial test'}
          >
            R{roundCount}
            {hasHistory && (
              <svg className={`h-3 w-3 transition-transform ${isHistoryExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </td>

        {/* Tester Name */}
        <td className="px-1 py-1 border-r border-gray-100 min-w-[100px]">
          <EditableCell
            value={latestRound?.tester_name || ''}
            onSave={async (v) => {
              if (latestRound?.id) {
                await handleRoundUpdate(latestRound.id, 'tester_name', v)
              }
            }}
            placeholder="Tester..."
            disabled={!hasActiveRound}
          />
        </td>

        {/* Call Recording URL */}
        <td className="px-1 py-1 border-r border-gray-100 min-w-[150px]">
          {hasActiveRound ? (
            <div className="flex items-center gap-1">
              <EditableCell
                value={latestRound?.call_link || ''}
                onSave={async (v) => {
                  if (latestRound?.id) {
                    await handleRoundUpdate(latestRound.id, 'call_link', v)
                  }
                }}
                placeholder="Paste URL..."
                type="url"
                className="flex-1 text-xs"
              />
              {latestRound?.call_link && (
                <a
                  href={latestRound.call_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-blue-600 hover:text-blue-800 p-1"
                  title="Open recording"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          ) : (
            <div className="rounded px-2 py-1 text-sm bg-gray-100 text-gray-300 min-h-[28px] cursor-not-allowed">—</div>
          )}
        </td>

        {/* Result */}
        <td className="px-1 py-1 border-r border-gray-100 w-[120px]">
          <ResultDropdown
            value={latestRound?.result || null}
            onSave={async (v) => {
              if (latestRound?.id) {
                await handleRoundUpdate(latestRound.id, 'result', v)
              }
            }}
            disabled={!hasActiveRound}
          />
        </td>

        {/* Comments */}
        <td className="px-1 py-1 border-r border-gray-100 min-w-[150px] max-w-[250px]">
          <EditableCell
            value={latestRound?.comments || ''}
            onSave={async (v) => {
              if (latestRound?.id) {
                await handleRoundUpdate(latestRound.id, 'comments', v)
              }
            }}
            placeholder="Comments..."
            type="textarea"
            className="line-clamp-2"
            disabled={!hasActiveRound}
          />
        </td>

        {/* RTR */}
        <td className="px-1 py-1 border-r border-gray-100 w-[60px]">
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={isAwaitingRetest}
              onChange={(e) => handleRTRChange(e.target.checked)}
              disabled={creatingRound || !canTriggerRetest || isAwaitingRetest}
              className={`h-4 w-4 rounded border-gray-300 text-brand-dark focus:ring-gray-400 ${
                (!canTriggerRetest || isAwaitingRetest) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              } ${creatingRound ? 'animate-pulse' : ''}`}
              title={
                isAwaitingRetest 
                  ? 'Awaiting retest results' 
                  : canTriggerRetest 
                    ? 'Check to create a new retest round' 
                    : 'Only less than perfect tests can be marked for retest'
              }
            />
          </div>
        </td>

        {/* Resolution Notes */}
        <td className="px-1 py-1 border-r border-gray-100 min-w-[150px] max-w-[250px]">
          <EditableCell
            value={testCase.polyai_resolution_comments}
            onSave={(v) => handleTestCaseUpdate('polyai_resolution_comments', v)}
            placeholder="Resolution notes..."
            type="textarea"
            className="line-clamp-2"
          />
        </td>

        {/* Ticket Column */}
        <td className="px-1 py-1 border-r border-gray-100 w-[60px]">
          <div className="flex items-center justify-center">
            {isChild ? (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Linked
              </span>
            ) : testCase.jira_ticket_id ? (
              <span className="text-xs text-blue-600 font-medium">
                {testCase.jira_ticket_id}
                {isParent && ' 🔗'}
              </span>
            ) : (
              <span className="text-xs text-gray-400">-</span>
            )}
          </div>
        </td>

        {/* Actions - Delete/Ungroup */}
        <td className="px-1 py-1 w-[50px]">
          <div className="flex items-center justify-center gap-1">
            {isChild && (
              <button
                onClick={handleUngroup}
                className="text-blue-400 hover:text-blue-600 p-1"
                title="Remove from group"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-400 hover:text-red-600 p-1"
              title="Delete test case"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>

      {/* History Expansion Row */}
      {isHistoryExpanded && hasHistory && (
        <tr className="bg-purple-50/50 border-b border-gray-200">
          <td colSpan={13} className="px-4 py-3">
            <div className="text-xs font-medium text-purple-700 mb-2">Testing History</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="px-2 py-1 text-left w-16">Round</th>
                    <th className="px-2 py-1 text-left">Tester</th>
                    <th className="px-2 py-1 text-left">Call Recording</th>
                    <th className="px-2 py-1 text-left w-28">Result</th>
                    <th className="px-2 py-1 text-left">Comments</th>
                    <th className="px-2 py-1 text-left w-32">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {testCase.rounds.map((round) => {
                    const resultOption = resultOptions.find(o => o.value === round.result) || resultOptions[0]
                    return (
                      <tr key={round.id} className={round.id === latestRound?.id ? 'bg-purple-100/50' : 'bg-white'}>
                        <td className="px-2 py-1.5 font-medium">
                          R{round.round_number}
                          {round.id === latestRound?.id && (
                            <span className="ml-1 text-xs text-purple-600">(current)</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">{round.tester_name || '-'}</td>
                        <td className="px-2 py-1.5">
                          {round.call_link ? (
                            <a
                              href={round.call_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate block max-w-[200px]"
                            >
                              {round.call_link}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-2 py-1.5">
                          {round.result ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${resultOption.color}`}>
                              {resultOption.label}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-2 py-1.5 max-w-[200px] truncate">{round.comments || '-'}</td>
                        <td className="px-2 py-1.5 text-gray-500">
                          {new Date(round.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
