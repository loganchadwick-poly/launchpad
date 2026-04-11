'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateIssueGroupName } from '@/app/actions/grouping'
import DraggableIssueRow from './DraggableIssueRow'
import type { Issue } from '@/lib/types/database.types'

interface Props {
  parent: Issue
  children: Issue[]
  issueTrackerId: string
  getDropState: (id: string) => 'dragging' | 'over' | null
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
      setCurrentValue(value)
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

const statusColors: Record<string, string> = {
  'In Progress': 'bg-yellow-100 text-yellow-700',
  'Backlogged': 'bg-gray-100 text-gray-700',
  'Resolved': 'bg-green-100 text-green-700',
  'More Info Needed': 'bg-orange-100 text-orange-700',
  'Non-Actionable': 'bg-gray-100 text-gray-500',
  'Accepted for Fix': 'bg-blue-100 text-blue-700',
}

export default function GroupedIssueRows({ 
  parent, 
  children, 
  issueTrackerId,
  getDropState 
}: Props) {
  const totalRows = 1 + children.length
  
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
  
  async function handleGroupNameSave(newName: string) {
    await updateIssueGroupName(parent.id, newName, issueTrackerId)
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
      
      {/* Status indicator */}
      <div className="mt-auto px-2 pt-2">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColors[parent.status] || 'bg-gray-100 text-gray-600'}`}>
          {parent.status}
        </span>
      </div>
    </div>
  )

  return (
    <Fragment>
      {/* Parent Row */}
      <DraggableIssueRow
        issue={parent}
        issueTrackerId={issueTrackerId}
        isChild={false}
        isParent={true}
        dropState={getDropState(parent.id)}
        showGroupCell={true}
        groupCellContent={groupCellContent}
        groupRowSpan={totalRows}
      />
      
      {/* Child Rows */}
      {children.map((child) => (
        <DraggableIssueRow
          key={child.id}
          issue={child}
          issueTrackerId={issueTrackerId}
          isChild={true}
          isParent={false}
          dropState={getDropState(child.id)}
          showGroupCell={false}
        />
      ))}
    </Fragment>
  )
}
