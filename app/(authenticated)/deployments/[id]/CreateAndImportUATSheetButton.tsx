'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createEmptyUATSheet } from '@/app/actions/uat'
import { previewImport, confirmImport } from '@/app/actions/uat-import'
import type { ImportPreview, ColumnMapping } from '@/lib/uat-import/types'

type Phase = 'name' | 'parsing' | 'preview' | 'creating' | 'importing' | 'done' | 'error'

export default function CreateAndImportUATSheetButton({ deploymentId }: { deploymentId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('name')
  const [sheetName, setSheetName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mappingsBySheet, setMappingsBySheet] = useState<Record<string, ColumnMapping[]>>({})
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [importedSheetCount, setImportedSheetCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function reset() {
    setPhase('name')
    setSheetName('')
    setError(null)
    setPreview(null)
    setMappingsBySheet({})
    setActiveSheet(null)
    setImportedCount(0)
    setImportedSheetCount(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function close() {
    setIsOpen(false)
    setTimeout(reset, 200)
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!sheetName.trim()) {
      setError('Enter a sheet name first.')
      return
    }
    setError(null)
    setPhase('parsing')

    const formData = new FormData()
    formData.append('file', file)
    const res = await previewImport(formData)
    if (!res.success) {
      setError(res.error)
      setPhase('name')
      return
    }
    setPreview(res.preview)
    const mapBySheet: Record<string, ColumnMapping[]> = {}
    for (const s of res.preview.sheets) mapBySheet[s.sheetName] = s.mappings
    setMappingsBySheet(mapBySheet)
    setActiveSheet(res.preview.sheets[0]?.sheetName ?? null)
    setPhase('preview')
  }

  function toggleSkip(sheetName: string, index: number) {
    setMappingsBySheet((prev) => ({
      ...prev,
      [sheetName]: (prev[sheetName] ?? []).map((m, i) =>
        i === index ? { ...m, skip: !m.skip } : m,
      ),
    }))
  }

  async function handleConfirm() {
    if (!preview) return
    setError(null)
    setPhase('creating')

    // Step 1: create the primary sheet with the user's chosen name. Tab 1
    // of the import will populate it. Additional tabs create their own
    // sibling sheets automatically in confirmImport.
    const createRes = await createEmptyUATSheet(deploymentId, sheetName.trim())
    if ('error' in createRes) {
      setError(createRes.error)
      setPhase('preview')
      return
    }

    setPhase('importing')
    const importRes = await confirmImport({
      uatSheetId: createRes.id,
      payloadB64: preview.payloadB64,
      payloadKind: preview.payloadKind,
      sheets: preview.sheets.map((s) => ({
        sheetName: s.sheetName,
        mappings: mappingsBySheet[s.sheetName] ?? s.mappings,
      })),
    })

    if (!importRes.success) {
      setError(`Sheet created but import failed: ${importRes.error}`)
      setImportedCount(0)
      router.push(`/uat-sheets/${createRes.id}`)
      return
    }

    setImportedCount(importRes.result.totalInserted)
    setImportedSheetCount(importRes.result.sheets.length)
    setPhase('done')
    setTimeout(() => {
      router.push(`/uat-sheets/${createRes.id}`)
    }, 1500)
  }

  const activeSheetPreview = preview?.sheets.find((s) => s.sheetName === activeSheet)
  const activeMappings = activeSheet ? mappingsBySheet[activeSheet] ?? [] : []
  const totalActiveMappings = Object.values(mappingsBySheet).reduce(
    (sum, arr) => sum + arr.filter((m) => !m.skip).length,
    0,
  )
  const totalRows = preview?.sheets.reduce((sum, s) => sum + s.totalRows, 0) ?? 0

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-outline inline-flex items-center gap-2 text-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import from XLSX
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-brand-dark">Create Sheet from Import</h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* NAME + FILE PICKER */}
            {phase === 'name' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="import_sheet_name" className="block text-sm font-medium text-brand-dark mb-1.5">
                    Sheet Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="import_sheet_name"
                    type="text"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="input-field"
                    placeholder="e.g., Phase 1 UAT"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    For multi-tab files, the first tab goes in this sheet; additional tabs create siblings named &ldquo;{sheetName.trim() || 'Name'} — TabName&rdquo;.
                  </p>
                </div>

                <label
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 ${
                    sheetName.trim() ? 'cursor-pointer border-gray-300 bg-gray-50 hover:border-brand-purple hover:bg-purple-50' : 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-brand-dark">Click to choose a file</span>
                  <span className="mt-1 text-xs text-gray-500">.xlsx, up to 5 MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={handleFilePicked}
                    disabled={!sheetName.trim()}
                  />
                </label>
                <p className="text-xs text-gray-500">
                  We&apos;ll parse the file, detect section headers + repeated round columns, and use AI to match columns to the UAT schema.
                </p>
              </div>
            )}

            {(phase === 'parsing' || phase === 'creating' || phase === 'importing') && (
              <div className="py-10 text-center">
                <svg className="mx-auto h-10 w-10 animate-spin text-brand-purple" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="mt-4 text-sm text-gray-600">
                  {phase === 'parsing' && 'Parsing file and mapping columns with AI...'}
                  {phase === 'creating' && 'Creating sheet...'}
                  {phase === 'importing' && 'Importing test cases...'}
                </p>
              </div>
            )}

            {phase === 'preview' && preview && activeSheetPreview && (
              <div>
                <div className="mb-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{preview.fileName}</span>
                    {' · '}
                    {preview.sheets.length} tab{preview.sheets.length === 1 ? '' : 's'}
                    {' · '}
                    {totalRows} data row{totalRows === 1 ? '' : 's'}
                    {' · '}
                    {totalActiveMappings} column{totalActiveMappings === 1 ? '' : 's'} to import
                  </p>
                  {preview.sheets.length > 1 && (
                    <p className="mt-1 text-xs text-gray-600">
                      Tab 1 → &ldquo;{sheetName.trim()}&rdquo;. Tabs 2+ → new siblings named &ldquo;{sheetName.trim()} — TabName&rdquo;.
                    </p>
                  )}
                </div>

                {preview.sheets.length > 1 && (
                  <div className="mb-4 flex gap-1 border-b border-gray-200 overflow-x-auto">
                    {preview.sheets.map((s, idx) => (
                      <button
                        key={s.sheetName}
                        onClick={() => setActiveSheet(s.sheetName)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                          activeSheet === s.sheetName
                            ? 'border-brand-purple text-brand-purple'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {s.sheetName}
                        <span className="ml-2 text-xs text-gray-400">
                          {s.totalRows} row{s.totalRows === 1 ? '' : 's'}
                        </span>
                        <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${idx === 0 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {idx === 0 ? 'primary' : 'new sheet'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {activeSheetPreview.warnings.length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    {activeSheetPreview.warnings.map((w, i) => (
                      <p key={i} className="text-sm text-amber-800">{w}</p>
                    ))}
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    {preview.warnings.map((w, i) => (
                      <p key={i} className="text-sm text-amber-800">{w}</p>
                    ))}
                  </div>
                )}

                <div className="mb-2 text-sm font-medium text-brand-dark">Detected columns</div>
                <div className="mb-4 max-h-80 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Source header</th>
                        <th className="px-3 py-2">Mapped to</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-right">Include</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeMappings.map((m, i) => (
                        <tr key={i} className={m.skip ? 'bg-gray-50 text-gray-400' : ''}>
                          <td className="px-3 py-2 font-medium">{m.sourceHeader || <em className="text-gray-400">(blank)</em>}</td>
                          <td className="px-3 py-2">
                            {m.label}
                            {m.round ? <span className="ml-1 text-xs text-gray-500">(round {m.round})</span> : null}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                m.kind === 'core'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {m.kind === 'core' ? 'Core' : 'New column'}
                            </span>
                            {m.confidence === 'low' && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Low confidence
                              </span>
                            )}
                            {m.validation?.dataType === 'list' && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700" title={m.validation.options?.join(', ')}>
                                Dropdown ({m.validation.options?.length ?? 0})
                              </span>
                            )}
                            {m.validation?.dataType === 'boolean' && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                Checkbox
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => toggleSkip(activeSheetPreview.sheetName, i)}
                              className="text-xs font-medium text-brand-purple hover:underline"
                            >
                              {m.skip ? 'Include' : 'Skip'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={close} className="btn-outline flex-1">Cancel</button>
                  <button
                    onClick={handleConfirm}
                    disabled={totalActiveMappings === 0}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    Create &amp; import {totalRows} row{totalRows === 1 ? '' : 's'}
                    {preview.sheets.length > 1 ? ` into ${preview.sheets.length} sheets` : ''}
                  </button>
                </div>
              </div>
            )}

            {phase === 'done' && (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-semibold text-brand-dark">
                  Imported {importedCount} test case{importedCount === 1 ? '' : 's'} into {importedSheetCount} sheet{importedSheetCount === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-xs text-gray-500">Opening sheet...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
