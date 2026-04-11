'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { createIssueGroup, ungroupIssue, changeIssueGroupParent } from '@/app/actions/grouping'
import DraggableIssueRow from './DraggableIssueRow'
import GroupedIssueRows from './GroupedIssueRows'
import type { Issue } from '@/lib/types/database.types'

interface Props {
  issues: Issue[]
  issueTrackerId: string
}

// Group structure for rendering
interface IssueGroup {
  parent: Issue
  children: Issue[]
}

export default function DraggableIssueTable({ issues, issueTrackerId }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Organize issues into groups and standalone items
  const { groups, standaloneItems, itemsById } = useMemo(() => {
    const itemsById = new Map<string, Issue>()
    const childrenByParent = new Map<string, Issue[]>()
    const standalone: Issue[] = []
    
    // First pass: index all items and identify children
    issues.forEach(issue => {
      itemsById.set(issue.id, issue)
      if (issue.parent_issue_id) {
        const children = childrenByParent.get(issue.parent_issue_id) || []
        children.push(issue)
        childrenByParent.set(issue.parent_issue_id, children)
      }
    })
    
    // Second pass: build groups and standalone
    const groups: IssueGroup[] = []
    issues.forEach(issue => {
      // Skip if this is a child
      if (issue.parent_issue_id) return
      
      const children = childrenByParent.get(issue.id)
      if (children && children.length > 0) {
        // Sort children by group_order
        children.sort((a, b) => (a.group_order || 0) - (b.group_order || 0))
        groups.push({ parent: issue, children })
      } else {
        standalone.push(issue)
      }
    })
    
    return { groups, standaloneItems: standalone, itemsById }
  }, [issues])

  // Create a flat list of IDs for DnD
  const sortableIds = useMemo(() => {
    const ids: string[] = []
    
    // Interleave groups and standalone items based on date_reported
    const allItems = [
      ...groups.map(g => ({ type: 'group' as const, item: g, order: new Date(g.parent.date_reported).getTime() })),
      ...standaloneItems.map(s => ({ type: 'standalone' as const, item: s, order: new Date(s.date_reported).getTime() })),
    ].sort((a, b) => b.order - a.order) // Descending (newest first)
    
    allItems.forEach(({ type, item }) => {
      if (type === 'group') {
        const group = item as IssueGroup
        ids.push(group.parent.id)
        group.children.forEach(c => ids.push(c.id))
      } else {
        ids.push((item as Issue).id)
      }
    })
    
    return ids
  }, [groups, standaloneItems])

  const activeItem = activeId ? itemsById.get(activeId) : null

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)
    
    if (!over || active.id === over.id) return
    
    const draggedId = active.id as string
    const targetId = over.id as string
    
    const draggedItem = itemsById.get(draggedId)
    const targetItem = itemsById.get(targetId)
    
    if (!draggedItem || !targetItem) return
    
    // Determine if dragged item is a parent with children
    const draggedChildren = issues.filter(i => i.parent_issue_id === draggedId)
    const isParent = draggedChildren.length > 0
    
    // Check if target is in a group
    const targetIsChild = !!targetItem.parent_issue_id
    const targetIsParent = issues.some(i => i.parent_issue_id === targetId)
    const targetInGroup = targetIsChild || targetIsParent
    
    if (draggedItem.parent_issue_id) {
      // Dragged item is currently a child
      if (!targetInGroup) {
        // Dropping onto standalone - create new group with target as parent
        await createIssueGroup(targetId, draggedId, issueTrackerId)
      } else {
        // Dropping onto a group - move to that group
        const targetParentId = targetItem.parent_issue_id || targetId
        if (targetParentId !== draggedItem.parent_issue_id) {
          await ungroupIssue(draggedId, issueTrackerId)
          await createIssueGroup(targetParentId, draggedId, issueTrackerId)
        }
      }
    } else if (isParent) {
      // Dragging a parent row (with children)
      if (targetInGroup || !targetItem.parent_issue_id) {
        // Move entire group under new parent
        await changeIssueGroupParent(draggedId, targetId, issueTrackerId)
      }
    } else {
      // Dragging a standalone row
      if (targetInGroup) {
        // Add to existing group
        const targetParentId = targetItem.parent_issue_id || targetId
        await createIssueGroup(targetParentId, draggedId, issueTrackerId)
      } else {
        // Create new group with target as parent
        await createIssueGroup(targetId, draggedId, issueTrackerId)
      }
    }
  }, [itemsById, issues, issueTrackerId])

  // Check if a row should show drop indicator
  const getDropState = useCallback((id: string) => {
    if (!activeId || !overId) return null
    if (activeId === id) return 'dragging'
    if (overId === id) return 'over'
    return null
  }, [activeId, overId])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-[140px]">Issue Group</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 min-w-[200px]">Issue Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 min-w-[120px]">Reported By</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-32">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-24">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 min-w-[140px]">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 w-32">Expected Fix</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 min-w-[100px]">JIRA Ticket</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600 w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {(() => {
              // Build ordered list based on date_reported (newest first)
              const allItems = [
                ...groups.map(g => ({ type: 'group' as const, item: g, order: new Date(g.parent.date_reported).getTime() })),
                ...standaloneItems.map(s => ({ type: 'standalone' as const, item: s, order: new Date(s.date_reported).getTime() })),
              ].sort((a, b) => b.order - a.order)
              
              return allItems.map(({ type, item }) => {
                if (type === 'group') {
                  const group = item as IssueGroup
                  return (
                    <GroupedIssueRows
                      key={`group-${group.parent.id}`}
                      parent={group.parent}
                      children={group.children}
                      issueTrackerId={issueTrackerId}
                      getDropState={getDropState}
                    />
                  )
                } else {
                  const issue = item as Issue
                  return (
                    <DraggableIssueRow
                      key={issue.id}
                      issue={issue}
                      issueTrackerId={issueTrackerId}
                      isChild={false}
                      isParent={false}
                      dropState={getDropState(issue.id)}
                    />
                  )
                }
              })
            })()}
          </tbody>
        </table>
      </SortableContext>
      
      <DragOverlay>
        {activeItem ? (
          <table className="w-full bg-white shadow-lg rounded border border-blue-300 opacity-90">
            <tbody>
              <tr className="bg-blue-50">
                <td className="px-4 py-2 text-sm text-gray-700 truncate max-w-[200px]">
                  {activeItem.issue_name || 'Untitled issue'}
                </td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
