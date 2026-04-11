'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/getUser'
import { randomBytes } from 'crypto'

function generateShareableLink(): string {
  return randomBytes(16).toString('hex')
}

const DEFAULT_ROW_COUNT = 10

export async function deleteUATSheet(sheetId: string, deploymentId: string) {
  await requireAuth()
  const supabase = await createClient()

  // Test cases and rounds will cascade delete due to FK constraints
  const { error } = await supabase
    .from('uat_sheets')
    .delete()
    .eq('id', sheetId)

  if (error) {
    return { error: error.message }
  }

  // Revalidate both the deployment page and dashboard
  revalidatePath(`/deployments/${deploymentId}`)
  revalidatePath('/deployments')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function createUATSheet(formData: FormData) {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('uat_sheets')
    .insert({
      deployment_id: formData.get('deployment_id') as string,
      name: formData.get('name') as string,
      shareable_link_token: generateShareableLink(),
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Pre-populate with empty rows to encourage thorough testing
  const emptyRows = Array.from({ length: DEFAULT_ROW_COUNT }, (_, i) => ({
    uat_sheet_id: data.id,
    row_number: i + 1,
    test_label: '',
    test_script: '',
    polyai_resolution_comments: '',
    ready_to_retest: false,
  }))

  const { data: testCases, error: testCasesError } = await supabase
    .from('uat_test_cases')
    .insert(emptyRows)
    .select('id')

  if (testCasesError) {
    console.error('Error creating test cases:', testCasesError)
    // UAT sheet was created, but rows failed - still return success but log error
  }

  // Create Round 1 for each test case
  if (testCases && testCases.length > 0) {
    const rounds = testCases.map(tc => ({
      test_case_id: tc.id,
      round_number: 1,
      tester_name: '',
      call_link: '',
      comments: '',
    }))
    const { error: roundsError } = await supabase.from('uat_test_rounds').insert(rounds)
    
    if (roundsError) {
      console.error('Error creating rounds:', roundsError)
    }
  }

  revalidatePath(`/deployments/${formData.get('deployment_id')}`)
  return { success: true, data }
}
