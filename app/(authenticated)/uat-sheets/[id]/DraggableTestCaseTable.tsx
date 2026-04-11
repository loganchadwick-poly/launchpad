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
import { createUATGroup, ungroupUATRow, changeUATGroupParent } from '@/app/actions/grouping'
import DraggableTestCaseRow from './DraggableTestCaseRow'
import GroupedTestCaseRows from './GroupedTestCaseRows'
import type { UATTestCase, UATTestRound } from '@/lib/types/database.types'

export interface TestCaseWithRounds extends UATTestCase {
  rounds: UATTestRound[]
}

interface Props {
  testCases: TestCaseWithRounds[]
  uatSheetId: string
}

// Group structure for rendering
interface TestCaseGroup {
  parent: TestCaseWithRounds
  children: TestCaseWithRounds[]
}

export default function DraggableTestCaseTable({ testCases, uatSheetId }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Organize test cases into groups and standalone items
  const { groups, standaloneItems, itemsById } = useMemo(() => {
    const itemsById = new Map<string, TestCaseWithRounds>()
    const childrenByParent = new Map<string, TestCaseWithRounds[]>()
    const standalone: TestCaseWithRounds[] = []
    
    // First pass: index all items and identify children
    testCases.forEach(tc => {
      itemsById.set(tc.id, tc)
      if (tc.parent_row_id) {
        const children = childrenByParent.get(tc.parent_row_id) || []
        children.push(tc)
        childrenByParent.set(tc.parent_row_id, children)
      }
    })
    
    // Second pass: build groups and standalone
    const groups: TestCaseGroup[] = []
    testCases.forEach(tc => {
      // Skip if this is a child
      if (tc.parent_row_id) return
      
      const children = childrenByParent.get(tc.id)
      if (children && children.length > 0) {
        // Sort children by group_order
        children.sort((a, b) => (a.group_order || 0) - (b.group_order || 0))
        groups.push({ parent: tc, children })
      } else {
        standalone.push(tc)
      }
    })
    
    return { groups, standaloneItems: standalone, itemsById }
  }, [testCases])

  // Create a flat list of IDs for DnD
  const sortableIds = useMemo(() => {
    const ids: string[] = []
    
    // Interleave groups and standalone items based on row_number
    const allItems = [
      ...groups.map(g => ({ type: 'group' as const, item: g, order: g.parent.row_number })),
      ...standaloneItems.map(s => ({ type: 'standalone' as const, item: s, order: s.row_number })),
    ].sort((a, b) => a.order - b.order)
    
    allItems.forEach(({ type, item }) => {
      if (type === 'group') {
        const group = item as TestCaseGroup
        ids.push(group.parent.id)
        group.children.forEach(c => ids.push(c.id))
      } else {
        ids.push((item as TestCaseWithRounds).id)
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
    const draggedChildren = testCases.filter(tc => tc.parent_row_id === draggedId)
    const isParent = draggedChildren.length > 0
    
    // Check if target is in a group
    const targetIsChild = !!targetItem.parent_row_id
    const targetIsParent = testCases.some(tc => tc.parent_row_id === targetId)
    const targetInGroup = targetIsChild || targetIsParent
    
    // Case 1: Dragging a standalone onto another standalone - create new group
    // Case 2: Dragging onto a group (parent or child) - add to that group
    // Case 3: Dragging a child outside group - ungroup
    // Case 4: Dragging a parent - move entire group under new parent
    
    if (draggedItem.parent_row_id) {
      // Dragged item is currently a child
      if (!targetInGroup) {
        // Dropping onto standalone - create new group with target as parent
        await createUATGroup(targetId, draggedId, uatSheetId)
      } else {
        // Dropping onto a group - move to that group
        // First ungroup from current, then add to new
        const targetParentId = targetItem.parent_row_id || targetId
        if (targetParentId !== draggedItem.parent_row_id) {
          await ungroupUATRow(draggedId, uatSheetId)
          await createUATGroup(targetParentId, draggedId, uatSheetId)
        }
      }
    } else if (isParent) {
      // Dragging a parent row (with children)
      if (targetInGroup || !targetItem.parent_row_id) {
        // Move entire group under new parent
        await changeUATGroupParent(draggedId, targetId, uatSheetId)
      }
    } else {
      // Dragging a standalone row
      if (targetInGroup) {
        // Add to existing group
        const targetParentId = targetItem.parent_row_id || targetId
        await createUATGroup(targetParentId, draggedId, uatSheetId)
      } else {
        // Create new group with target as parent
        await createUATGroup(targetId, draggedId, uatSheetId)
      }
    }
  }, [itemsById, testCases, uatSheetId])

  // Check if a row should show drop indicator (being hovered over)
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
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 sticky top-0">
            <tr className="border-b-2 border-gray-300">
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-gray-600 w-[140px] border-r border-gray-200">Issue Group</th>
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-gray-600 w-12 border-r border-gray-200">#</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-600 min-w-[180px] border-r border-gray-200">Test Label</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-600 min-w-[200px] border-r border-gray-200">Test Script</th>
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-gray-600 w-[70px] border-r border-gray-200">Round</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-600 min-w-[100px] border-r border-gray-200">Tester</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-600 min-w-[150px] border-r border-gray-200">Call Recording</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-600 w-[120px] border-r border-gray-200">Result</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-600 min-w-[150px] border-r border-gray-200">Comments</th>
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-gray-600 w-[60px] border-r border-gray-200" title="New Retest Round">RTR</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-600 min-w-[150px] border-r border-gray-200">Resolution Notes</th>
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-gray-600 w-[60px]">Ticket</th>
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-gray-600 w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {/* Render in row_number order, handling both groups and standalone */}
            {(() => {
              // Build ordered list based on row_number
              const allItems = [
                ...groups.map(g => ({ type: 'group' as const, item: g, order: g.parent.row_number })),
                ...standaloneItems.map(s => ({ type: 'standalone' as const, item: s, order: s.row_number })),
              ].sort((a, b) => a.order - b.order)
              
              return allItems.map(({ type, item }) => {
                if (type === 'group') {
                  const group = item as TestCaseGroup
                  return (
                    <GroupedTestCaseRows
                      key={`group-${group.parent.id}`}
                      parent={group.parent}
                      children={group.children}
                      uatSheetId={uatSheetId}
                      getDropState={getDropState}
                    />
                  )
                } else {
                  const testCase = item as TestCaseWithRounds
                  return (
                    <DraggableTestCaseRow
                      key={testCase.id}
                      testCase={testCase}
                      uatSheetId={uatSheetId}
                      isChild={false}
                      isParent={false}
                      dropState={getDropState(testCase.id)}
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
                <td className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-12 border-r border-gray-100">
                  {activeItem.row_number}
                </td>
                <td className="px-2 py-2 text-sm text-gray-700 truncate max-w-[200px]">
                  {activeItem.test_label || 'Untitled test case'}
                </td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
