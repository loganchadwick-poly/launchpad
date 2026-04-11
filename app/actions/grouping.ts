'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// =====================================================
// HELPER: Generate group name from test label
// This is a pure helper function, not a server action
// =====================================================
function generateGroupNameFromLabel(testLabel: string): string {
  if (!testLabel || testLabel.trim() === '') {
    return 'Unnamed Group'
  }
  
  // Extract first 1-3 meaningful words
  const words = testLabel
    .replace(/[^\w\s]/g, '') // Remove special characters
    .split(/\s+/)
    .filter(word => word.length > 2) // Skip small words
    .slice(0, 2)
  
  if (words.length === 0) {
    return 'Issues'
  }
  
  // Capitalize first letter of each word
  const formattedWords = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
  
  return `${formattedWords} Issues`
}

// =====================================================
// UAT TEST CASES GROUPING
// =====================================================

/**
 * Creates a group by setting one row as the parent of another.
 * The targetRow becomes the parent, draggedRow becomes the child.
 */
export async function createUATGroup(
  targetRowId: string,
  draggedRowId: string,
  uatSheetId: string
) {
  const supabase = await createClient()
  
  // Get target row info to generate group name
  const { data: targetRow, error: targetError } = await supabase
    .from('uat_test_cases')
    .select('test_label, parent_row_id, group_name')
    .eq('id', targetRowId)
    .single()
    
  if (targetError) {
    return { error: targetError.message }
  }
  
  // Check if target row is already a child - if so, use its parent as the new parent
  let parentId = targetRowId
  if (targetRow.parent_row_id) {
    parentId = targetRow.parent_row_id
  }
  
  // Generate group name if parent doesn't have one
  let groupName = targetRow.group_name
  if (!groupName && !targetRow.parent_row_id) {
    groupName = generateGroupNameFromLabel(targetRow.test_label)
    // Update parent with group name
    await supabase
      .from('uat_test_cases')
      .update({ group_name: groupName })
      .eq('id', parentId)
  }
  
  // Get the current max group_order for this parent
  const { data: existingChildren } = await supabase
    .from('uat_test_cases')
    .select('group_order')
    .eq('parent_row_id', parentId)
    .order('group_order', { ascending: false })
    .limit(1)
    
  const nextOrder = existingChildren && existingChildren.length > 0
    ? (existingChildren[0].group_order || 0) + 1
    : 1
  
  // Get dragged row info to check if it has children
  const { data: draggedRow } = await supabase
    .from('uat_test_cases')
    .select('parent_row_id, group_name')
    .eq('id', draggedRowId)
    .single()
    
  // If dragged row was a parent, move all its children to the new parent
  if (draggedRow && !draggedRow.parent_row_id) {
    const { data: draggedChildren } = await supabase
      .from('uat_test_cases')
      .select('id')
      .eq('parent_row_id', draggedRowId)
      
    if (draggedChildren && draggedChildren.length > 0) {
      // Move children to new parent
      await supabase
        .from('uat_test_cases')
        .update({ parent_row_id: parentId })
        .eq('parent_row_id', draggedRowId)
    }
    
    // Clear group_name from former parent
    await supabase
      .from('uat_test_cases')
      .update({ group_name: null })
      .eq('id', draggedRowId)
  }
  
  // Make dragged row a child of the parent
  const { error: updateError } = await supabase
    .from('uat_test_cases')
    .update({ 
      parent_row_id: parentId,
      group_order: nextOrder,
      group_name: null // Children don't have group names
    })
    .eq('id', draggedRowId)
  
  if (updateError) {
    return { error: updateError.message }
  }
  
  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true, parentId }
}

/**
 * Removes a row from its group.
 * If only 1 row remains in group, auto-ungroup it too.
 */
export async function ungroupUATRow(rowId: string, uatSheetId: string) {
  const supabase = await createClient()
  
  // Get current parent
  const { data: row, error: rowError } = await supabase
    .from('uat_test_cases')
    .select('parent_row_id')
    .eq('id', rowId)
    .single()
    
  if (rowError || !row.parent_row_id) {
    return { error: 'Row is not in a group' }
  }
  
  const parentId = row.parent_row_id
  
  // Remove from group
  const { error: updateError } = await supabase
    .from('uat_test_cases')
    .update({ 
      parent_row_id: null,
      group_order: 0 
    })
    .eq('id', rowId)
  
  if (updateError) {
    return { error: updateError.message }
  }
  
  // Check how many children remain for the parent
  const { data: remainingChildren } = await supabase
    .from('uat_test_cases')
    .select('id')
    .eq('parent_row_id', parentId)
  
  // If no children remain, clear parent's group_name (trigger will also handle this)
  if (!remainingChildren || remainingChildren.length === 0) {
    await supabase
      .from('uat_test_cases')
      .update({ group_name: null })
      .eq('id', parentId)
  }
  
  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true }
}

/**
 * Update group name for a parent row.
 */
export async function updateUATGroupName(
  parentRowId: string,
  groupName: string,
  uatSheetId: string
) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('uat_test_cases')
    .update({ group_name: groupName })
    .eq('id', parentRowId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true }
}

/**
 * Reorder rows within a group.
 */
export async function reorderUATGroupRows(
  rowId: string,
  newOrder: number,
  uatSheetId: string
) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('uat_test_cases')
    .update({ group_order: newOrder })
    .eq('id', rowId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true }
}

/**
 * Change the parent of a group (when dragging a parent row onto another row).
 * All children follow the parent.
 */
export async function changeUATGroupParent(
  currentParentId: string,
  newParentId: string,
  uatSheetId: string
) {
  const supabase = await createClient()
  
  // Get new parent's test label for group name
  const { data: newParent, error: newParentError } = await supabase
    .from('uat_test_cases')
    .select('test_label, parent_row_id, group_name')
    .eq('id', newParentId)
    .single()
    
  if (newParentError) {
    return { error: newParentError.message }
  }
  
  // Determine the actual parent (in case newParent is already a child)
  let actualParentId = newParentId
  if (newParent.parent_row_id) {
    actualParentId = newParent.parent_row_id
  }
  
  // Generate group name if needed
  const groupName = newParent.group_name || generateGroupNameFromLabel(newParent.test_label)
  
  // Update new parent with group name
  if (!newParent.parent_row_id) {
    await supabase
      .from('uat_test_cases')
      .update({ group_name: groupName })
      .eq('id', actualParentId)
  }
  
  // Move all children of current parent to new parent
  await supabase
    .from('uat_test_cases')
    .update({ parent_row_id: actualParentId })
    .eq('parent_row_id', currentParentId)
  
  // Make current parent a child of new parent
  const { data: existingChildren } = await supabase
    .from('uat_test_cases')
    .select('group_order')
    .eq('parent_row_id', actualParentId)
    .order('group_order', { ascending: false })
    .limit(1)
    
  const nextOrder = existingChildren && existingChildren.length > 0
    ? (existingChildren[0].group_order || 0) + 1
    : 1
  
  await supabase
    .from('uat_test_cases')
    .update({ 
      parent_row_id: actualParentId,
      group_order: nextOrder,
      group_name: null
    })
    .eq('id', currentParentId)
  
  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true }
}

// =====================================================
// ISSUES GROUPING (Similar to UAT but for issues table)
// =====================================================

/**
 * Creates a group by setting one issue as the parent of another.
 */
export async function createIssueGroup(
  targetIssueId: string,
  draggedIssueId: string,
  issueTrackerId: string
) {
  const supabase = await createClient()
  
  // Get target issue info
  const { data: targetIssue, error: targetError } = await supabase
    .from('issues')
    .select('issue_name, parent_issue_id, group_name')
    .eq('id', targetIssueId)
    .single()
    
  if (targetError) {
    return { error: targetError.message }
  }
  
  // Determine actual parent
  let parentId = targetIssueId
  if (targetIssue.parent_issue_id) {
    parentId = targetIssue.parent_issue_id
  }
  
  // Generate group name if needed
  let groupName = targetIssue.group_name
  if (!groupName && !targetIssue.parent_issue_id) {
    groupName = generateGroupNameFromLabel(targetIssue.issue_name)
    await supabase
      .from('issues')
      .update({ group_name: groupName })
      .eq('id', parentId)
  }
  
  // Get max group_order
  const { data: existingChildren } = await supabase
    .from('issues')
    .select('group_order')
    .eq('parent_issue_id', parentId)
    .order('group_order', { ascending: false })
    .limit(1)
    
  const nextOrder = existingChildren && existingChildren.length > 0
    ? (existingChildren[0].group_order || 0) + 1
    : 1
  
  // Handle if dragged issue was a parent
  const { data: draggedIssue } = await supabase
    .from('issues')
    .select('parent_issue_id')
    .eq('id', draggedIssueId)
    .single()
    
  if (draggedIssue && !draggedIssue.parent_issue_id) {
    // Move children to new parent
    await supabase
      .from('issues')
      .update({ parent_issue_id: parentId })
      .eq('parent_issue_id', draggedIssueId)
      
    // Clear group_name
    await supabase
      .from('issues')
      .update({ group_name: null })
      .eq('id', draggedIssueId)
  }
  
  // Make dragged issue a child
  const { error: updateError } = await supabase
    .from('issues')
    .update({ 
      parent_issue_id: parentId,
      group_order: nextOrder,
      group_name: null
    })
    .eq('id', draggedIssueId)
  
  if (updateError) {
    return { error: updateError.message }
  }
  
  revalidatePath(`/issue-trackers/${issueTrackerId}`)
  return { success: true, parentId }
}

/**
 * Removes an issue from its group.
 */
export async function ungroupIssue(issueId: string, issueTrackerId: string) {
  const supabase = await createClient()
  
  const { data: issue, error: issueError } = await supabase
    .from('issues')
    .select('parent_issue_id')
    .eq('id', issueId)
    .single()
    
  if (issueError || !issue.parent_issue_id) {
    return { error: 'Issue is not in a group' }
  }
  
  const parentId = issue.parent_issue_id
  
  const { error: updateError } = await supabase
    .from('issues')
    .update({ 
      parent_issue_id: null,
      group_order: 0 
    })
    .eq('id', issueId)
  
  if (updateError) {
    return { error: updateError.message }
  }
  
  // Check remaining children
  const { data: remainingChildren } = await supabase
    .from('issues')
    .select('id')
    .eq('parent_issue_id', parentId)
  
  if (!remainingChildren || remainingChildren.length === 0) {
    await supabase
      .from('issues')
      .update({ group_name: null })
      .eq('id', parentId)
  }
  
  revalidatePath(`/issue-trackers/${issueTrackerId}`)
  return { success: true }
}

/**
 * Update group name for a parent issue.
 */
export async function updateIssueGroupName(
  parentIssueId: string,
  groupName: string,
  issueTrackerId: string
) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('issues')
    .update({ group_name: groupName })
    .eq('id', parentIssueId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath(`/issue-trackers/${issueTrackerId}`)
  return { success: true }
}

/**
 * Change the parent of an issue group.
 */
export async function changeIssueGroupParent(
  currentParentId: string,
  newParentId: string,
  issueTrackerId: string
) {
  const supabase = await createClient()
  
  const { data: newParent, error: newParentError } = await supabase
    .from('issues')
    .select('issue_name, parent_issue_id, group_name')
    .eq('id', newParentId)
    .single()
    
  if (newParentError) {
    return { error: newParentError.message }
  }
  
  let actualParentId = newParentId
  if (newParent.parent_issue_id) {
    actualParentId = newParent.parent_issue_id
  }
  
  const groupName = newParent.group_name || generateGroupNameFromLabel(newParent.issue_name)
  
  if (!newParent.parent_issue_id) {
    await supabase
      .from('issues')
      .update({ group_name: groupName })
      .eq('id', actualParentId)
  }
  
  // Move children
  await supabase
    .from('issues')
    .update({ parent_issue_id: actualParentId })
    .eq('parent_issue_id', currentParentId)
  
  // Get next order
  const { data: existingChildren } = await supabase
    .from('issues')
    .select('group_order')
    .eq('parent_issue_id', actualParentId)
    .order('group_order', { ascending: false })
    .limit(1)
    
  const nextOrder = existingChildren && existingChildren.length > 0
    ? (existingChildren[0].group_order || 0) + 1
    : 1
  
  // Make current parent a child
  await supabase
    .from('issues')
    .update({ 
      parent_issue_id: actualParentId,
      group_order: nextOrder,
      group_name: null
    })
    .eq('id', currentParentId)
  
  revalidatePath(`/issue-trackers/${issueTrackerId}`)
  return { success: true }
}
