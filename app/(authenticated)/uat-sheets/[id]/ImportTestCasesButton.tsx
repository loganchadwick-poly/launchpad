'use client'

import { useState, useRef } from 'react'
import { previewImport, confirmImport } from '@/app/actions/uat-import'
import type { ImportPreview, ColumnMapping, ImportResult } from '@/lib/uat-import/types'

type Phase = 'idle' | 'uploading' | 'preview' | 'importing' | 'done'

export default function ImportTestCasesButton({ uatSheetId }: { uatSheetId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setPhase('idle')
    setError(null)
    setPreview(null)
    setMappings([])
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function close() {
    setIsOpen(false)
    // Wait for close animation before resetting state
    setTimeout(reset, 200)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setPhase('uploading')

    const formData = new FormData()
    formData.append('file', file)

    const res = await previewImport(formData)
    if (!res.success) {
      setError(res.error)
      setPhase('idle')
      return
    }
    setPreview(res.preview)
    setMappings(res.preview.mappings)
    setPhase('preview')
  }

  function toggleSkip(index: number) {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, skip: !m.skip } : m)),
    )
  }

  async function handleConfirm() {
    if (!preview) return
    setPhase('importing')
    setError(null)

    const res = await confirmImport({
      uatSheetId,
      payloadB64: preview.payloadB64,
      payloadKind: preview.payloadKind,
      mappings,
    })

    if (!res.success) {
      setError(res.error)
      setPhase('preview')
      return
    }
    setResult(res.result)
    setPhase('done')
  }

  const activeMappingCount = mappings.filter((m) => !m.skip).length

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-outline inline-flex items-center gap-2"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import XLSX
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-brand-dark">
                {phase === 'done' ? 'Import complete' : 'Import Test Cases'}
              </h2>
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

            {/* IDLE — file picker */}
            {phase === 'idle' && (
              <div>
                <p className="mb-4 text-sm text-gray-600">
                  Upload an XLSX file of test cases. We&apos;ll use AI to match its columns to this sheet&apos;s fields, and unknown columns become new custom columns on the sheet.
                </p>
                <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  <span className="font-semibold">Why XLSX?</span> XLSX preserves dropdown menus and checkboxes from Google Sheets or Excel, so we can recreate them as real dropdowns and checkboxes here. CSV is plain text and strips that metadata — in Google Sheets, use <span className="font-medium">File → Download → Microsoft Excel (.xlsx)</span>.
                </p>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-10 hover:border-brand-purple hover:bg-purple-50">
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
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            )}

            {/* UPLOADING / IMPORTING */}
            {(phase === 'uploading' || phase === 'importing') && (
              <div className="py-10 text-center">
                <svg className="mx-auto h-10 w-10 animate-spin text-brand-purple" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="mt-4 text-sm text-gray-600">
                  {phase === 'uploading' ? 'Parsing file and mapping columns with AI...' : 'Importing test cases...'}
                </p>
              </div>
            )}

            {/* PREVIEW — detected mapping */}
            {phase === 'preview' && preview && (
              <div>
                <div className="mb-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{preview.fileName}</span>
                    {' · '}
                    {preview.totalRows} row{preview.totalRows === 1 ? '' : 's'}
                    {' · '}
                    {activeMappingCount} of {mappings.length} columns will be imported
                  </p>
                </div>

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
                      {mappings.map((m, i) => (
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
                              onClick={() => toggleSkip(i)}
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
                    disabled={activeMappingCount === 0}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    Import {preview.totalRows} row{preview.totalRows === 1 ? '' : 's'}
                  </button>
                </div>
              </div>
            )}

            {/* DONE — result summary */}
            {phase === 'done' && result && (
              <div>
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-green-900">
                        Imported {result.inserted} test case{result.inserted === 1 ? '' : 's'}
                      </p>
                      <p className="mt-0.5 text-xs text-green-800">
                        Sheet now has {result.newColumnConfig.length} column{result.newColumnConfig.length === 1 ? '' : 's'} configured.
                      </p>
                    </div>
                  </div>
                </div>

                {result.warnings.length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Warnings</p>
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-sm text-amber-800">{w}</p>
                    ))}
                  </div>
                )}

                <button onClick={close} className="btn-primary w-full">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
