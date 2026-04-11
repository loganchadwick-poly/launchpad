'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Quick add - creates an empty row with Round 1 for spreadsheet-style editing
export async function addEmptyRow(uatSheetId: string) {
  const supabase = await createClient()
  
  // Get the highest row number for this sheet
  const { data: existingCases } = await supabase
    .from('uat_test_cases')
    .select('row_number')
    .eq('uat_sheet_id', uatSheetId)
    .order('row_number', { ascending: false })
    .limit(1)
  
  const nextRowNumber = existingCases && existingCases.length > 0 
    ? existingCases[0].row_number + 1 
    : 1

  // Create the test case
  const { data: testCase, error: testCaseError } = await supabase
    .from('uat_test_cases')
    .insert({
      uat_sheet_id: uatSheetId,
      row_number: nextRowNumber,
      test_label: '',
      test_script: '',
      polyai_resolution_comments: '',
      ready_to_retest: false,
    })
    .select()
    .single()

  if (testCaseError) {
    return { error: testCaseError.message }
  }

  // Create Round 1 for this test case
  const { error: roundError } = await supabase
    .from('uat_test_rounds')
    .insert({
      test_case_id: testCase.id,
      round_number: 1,
      tester_name: '',
      call_link: '',
      comments: '',
    })

  if (roundError) {
    return { error: roundError.message }
  }

  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true }
}

export async function addTestCase(formData: FormData) {
  const supabase = await createClient()
  
  const uatSheetId = formData.get('uat_sheet_id') as string
  
  // Get the highest row number for this sheet
  const { data: existingCases } = await supabase
    .from('uat_test_cases')
    .select('row_number')
    .eq('uat_sheet_id', uatSheetId)
    .order('row_number', { ascending: false })
    .limit(1)
  
  const nextRowNumber = existingCases && existingCases.length > 0 
    ? existingCases[0].row_number + 1 
    : 1

  // Create the test case
  const { data: testCase, error: testCaseError } = await supabase
    .from('uat_test_cases')
    .insert({
      uat_sheet_id: uatSheetId,
      row_number: nextRowNumber,
      test_label: formData.get('test_label') as string,
      test_script: formData.get('test_script') as string || '',
      polyai_resolution_comments: '',
      ready_to_retest: false,
    })
    .select()
    .single()

  if (testCaseError) {
    return { error: testCaseError.message }
  }

  // Create Round 1 for this test case
  const { error: roundError } = await supabase
    .from('uat_test_rounds')
    .insert({
      test_case_id: testCase.id,
      round_number: 1,
      tester_name: '',
      call_link: '',
      comments: '',
    })

  if (roundError) {
    return { error: roundError.message }
  }

  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true }
}

// Update test case fields (test_label, test_script, polyai_resolution_comments, ready_to_retest)
export async function updateTestCase(formData: FormData) {
  const supabase = await createClient()
  
  const id = formData.get('id') as string
  const uatSheetId = formData.get('uat_sheet_id') as string
  
  const updates: Record<string, string | boolean> = {}
  
  // Only update test case fields (not round fields)
  const testCaseFields = ['test_label', 'test_script', 'polyai_resolution_comments', 'ready_to_retest']
  
  testCaseFields.forEach(field => {
    const value = formData.get(field)
    if (value !== null) {
      if (field === 'ready_to_retest') {
        updates[field] = value === 'true'
      } else {
        updates[field] = value as string
      }
    }
  })

  // Check if we're marking ready_to_retest as true - if so, create a new round
  if (updates.ready_to_retest === true) {
    // Get current round count
    const { data: rounds } = await supabase
      .from('uat_test_rounds')
      .select('round_number')
      .eq('test_case_id', id)
      .order('round_number', { ascending: false })
      .limit(1)

    const currentRound = rounds && rounds.length > 0 ? rounds[0].round_number : 0
    const nextRound = currentRound + 1

    // Create new round
    await supabase
      .from('uat_test_rounds')
      .insert({
        test_case_id: id,
        round_number: nextRound,
        tester_name: '',
        call_link: '',
        comments: '',
      })
    
    // Reset ready_to_retest after creating the new round
    updates.ready_to_retest = false
  }

  if (Object.keys(updates).length > 0) {
  const { error } = await supabase
    .from('uat_test_cases')
    .update(updates)
    .eq('id', id)

  if (error) {
    return { error: error.message }
    }
  }

  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true }
}

// Update a specific test round
export async function updateTestRound(formData: FormData) {
  const supabase = await createClient()
  
  const roundId = formData.get('round_id') as string
  const uatSheetId = formData.get('uat_sheet_id') as string
  
  const updates: Record<string, string | null> = {}
  
  const roundFields = ['tester_name', 'call_link', 'result', 'comments']
  
  roundFields.forEach(field => {
    const value = formData.get(field)
    if (value !== null) {
      // Handle empty result as null
      if (field === 'result' && value === '') {
        updates[field] = null
      } else {
        updates[field] = value as string
      }
    }
  })

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('uat_test_rounds')
      .update(updates)
      .eq('id', roundId)

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true }
}

// Create a new retest round for a test case
export async function createNewRound(testCaseId: string, uatSheetId: string) {
  const supabase = await createClient()
  
  // Get current round count
  const { data: rounds } = await supabase
    .from('uat_test_rounds')
    .select('round_number')
    .eq('test_case_id', testCaseId)
    .order('round_number', { ascending: false })
    .limit(1)

  const currentRound = rounds && rounds.length > 0 ? rounds[0].round_number : 0
  const nextRound = currentRound + 1

  // Create new round
  const { error } = await supabase
    .from('uat_test_rounds')
    .insert({
      test_case_id: testCaseId,
      round_number: nextRound,
      tester_name: '',
      call_link: '',
      comments: '',
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true, roundNumber: nextRound }
}

export async function deleteTestCase(id: string, uatSheetId: string) {
  const supabase = await createClient()

  // Rounds will be cascade deleted due to FK constraint
  const { error } = await supabase
    .from('uat_test_cases')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/uat-sheets/${uatSheetId}`)
  return { success: true }
}
