'use client'

import { useState } from 'react'
import { addEmptyRow } from '@/app/actions/uat-test-cases'

interface Props {
  uatSheetId: string
}

export default function AddRowButton({ uatSheetId }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleAddRow() {
    setLoading(true)
    await addEmptyRow(uatSheetId)
    setLoading(false)
  }

  return (
    <button
      onClick={handleAddRow}
      disabled={loading}
      className="w-full py-2 px-4 text-sm text-gray-500 hover:text-brand-dark hover:bg-gray-50 border-t border-gray-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {loading ? 'Adding...' : 'Add Row'}
    </button>
  )
}
