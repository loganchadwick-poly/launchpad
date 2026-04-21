'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateUATGroupName } from '@/app/actions/grouping'
import DraggableTestCaseRow from './DraggableTestCaseRow'
import type { UATColumn, UATTestCase, UATTestRound } from '@/lib/types/database.types'

interface TestCaseWithRounds extends UATTestCase {
  rounds: UATTestRound[]
}

interface Props {
  parent: TestCaseWithRounds
  children: TestCaseWithRounds[]
  uatSheetId: string
  getDropState: (id: string) => 'dragging' | 'over' | null
  customColumns: UATColumn[]
}

// Editable group name component
function EditableGroupName({ 
  value, 
  onSave, 
  placeholder = 'Group name...'
}: { 
  value: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [currentValue, setCurrentValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    if (currentValue !== value && currentValue.trim()) {
      setSaving(true)
      await onSave(currentValue)
      setSaving(false)
    } else if (!currentValue.trim()) {
      setCurrentValue(value) // Reset if empty
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setCurrentValue(value)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-text rounded px-2 py-1 text-sm font-semibold text-blue-800 hover:bg-blue-100 ${saving ? 'opacity-50' : ''}`}
      title="Click to edit group name"
    >
      {currentValue || <span className="text-blue-400">{placeholder}</span>}
    </div>
  )
}

export default function GroupedTestCaseRows({
  parent,
  children,
  uatSheetId,
  getDropState,
  customColumns,
}: Props) {
  const totalRows = 1 + children.length // Parent + children
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: parent.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Get latest round from parent for ticket display
  const parentLatestRound = parent.rounds[parent.rounds.length - 1]
  
  async function handleGroupNameSave(newName: string) {
    await updateUATGroupName(parent.id, newName, uatSheetId)
  }

  // Group cell content that spans all rows
  const groupCellContent = (
    <div 
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-1 p-2 h-full ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Drag handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-blue-400 hover:text-blue-600 self-start"
        title="Drag group"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
      
      {/* Editable Group Name */}
      <EditableGroupName
        value={parent.group_name || ''}
        onSave={handleGroupNameSave}
        placeholder="Group name..."
      />
      
      {/* Issue Count */}
      <p className="text-xs text-blue-600 px-2">
        ({totalRows} issues)
      </p>
      
      {/* Parent Ticket Info */}
      {parent.jira_ticket_id && (
        <div className="mt-1 px-2">
          <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {parent.jira_ticket_id}
          </span>
        </div>
      )}
      
      {/* Status indicator based on latest result */}
      {parentLatestRound?.result && (
        <div className="mt-auto px-2 pt-2">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            parentLatestRound.result.includes('Perfect') ? 'bg-green-100 text-green-700' :
            parentLatestRound.result.includes('Imperfect') ? 'bg-yellow-100 text-yellow-700' :
            parentLatestRound.result.includes('Good UX') ? 'bg-orange-100 text-orange-700' :
            'bg-red-100 text-red-700'
          }`}>
            {parentLatestRound.result.includes('Perfect') ? 'Perfect' :
             parentLatestRound.result.includes('Imperfect') ? 'Imperfect' :
             parentLatestRound.result.includes('Good UX') ? 'Good UX' : 'Bad UX'}
          </span>
        </div>
      )}
    </div>
  )

  return (
    <Fragment>
      {/* Parent Row - with group cell that spans all rows */}
      <DraggableTestCaseRow
        testCase={parent}
        uatSheetId={uatSheetId}
        isChild={false}
        isParent={true}
        dropState={getDropState(parent.id)}
        showGroupCell={true}
        groupCellContent={groupCellContent}
        groupRowSpan={totalRows}
        customColumns={customColumns}
      />

      {/* Child Rows - no group cell (handled by rowSpan) */}
      {children.map((child) => (
        <DraggableTestCaseRow
          key={child.id}
          testCase={child}
          uatSheetId={uatSheetId}
          isChild={true}
          isParent={false}
          dropState={getDropState(child.id)}
          showGroupCell={false}
          customColumns={customColumns}
        />
      ))}
    </Fragment>
  )
}
