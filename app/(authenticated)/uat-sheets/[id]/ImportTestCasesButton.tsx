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
  // Mappings are keyed by sheet name so edits on one tab don't leak to another.
  const [mappingsBySheet, setMappingsBySheet] = useState<Record<string, ColumnMapping[]>>({})
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setPhase('idle')
    setError(null)
    setPreview(null)
    setMappingsBySheet({})
    setActiveSheet(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function close() {
    setIsOpen(false)
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
    setPhase('importing')
    setError(null)

    const res = await confirmImport({
      uatSheetId,
      payloadB64: preview.payloadB64,
      payloadKind: preview.payloadKind,
      sheets: preview.sheets.map((s) => ({
        sheetName: s.sheetName,
        mappings: mappingsBySheet[s.sheetName] ?? s.mappings,
      })),
    })

    if (!res.success) {
      setError(res.error)
      setPhase('preview')
      return
    }
    setResult(res.result)
    setPhase('done')
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
        className="btn-outline inline-flex items-center gap-2"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import XLSX
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
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
                <p className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800">
                  <span className="font-semibold">Multi-tab files:</span> if your XLSX has more than one worksheet, the first tab populates this sheet and each additional tab creates a new UAT sheet on this deployment, named after its tab.
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

            {/* PREVIEW — per-sheet tabs + mappings */}
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
                      Tab 1 populates this sheet; tabs 2+ create new sibling UAT sheets named after the source tab.
                    </p>
                  )}
                </div>

                {/* Sheet tabs */}
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
                        {idx === 0 ? (
                          <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            this sheet
                          </span>
                        ) : (
                          <span className="ml-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                            new sheet
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Warnings for the active sheet */}
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
                    Import {totalRows} row{totalRows === 1 ? '' : 's'}
                    {preview.sheets.length > 1 ? ` across ${preview.sheets.length} sheets` : ''}
                  </button>
                </div>
              </div>
            )}

            {/* DONE — per-sheet result summary */}
            {phase === 'done' && result && (
              <div>
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-green-900">
                        Imported {result.totalInserted} test case{result.totalInserted === 1 ? '' : 's'} across {result.sheets.length} sheet{result.sheets.length === 1 ? '' : 's'}
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-green-800">
                        {result.sheets.map((s) => (
                          <li key={s.uatSheetId}>
                            <span className="font-medium">{s.uatSheetName}</span>
                            {s.isNew && <span className="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">new</span>}
                            {' — '}
                            {s.inserted} row{s.inserted === 1 ? '' : 's'}
                            {s.skippedDuplicates > 0 ? `, ${s.skippedDuplicates} duplicate${s.skippedDuplicates === 1 ? '' : 's'} skipped` : ''}
                            {s.isNew && (
                              <a href={`/uat-sheets/${s.uatSheetId}`} className="ml-2 text-brand-purple underline">
                                open
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
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

                {result.sheets.flatMap((s) =>
                  s.warnings.map((w) => `${s.sheetName}: ${w}`),
                ).length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 max-h-40 overflow-y-auto">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Per-sheet notes</p>
                    {result.sheets.flatMap((s) =>
                      s.warnings.map((w, i) => (
                        <p key={`${s.sheetName}-${i}`} className="text-sm text-amber-800">
                          <span className="font-medium">{s.sheetName}:</span> {w}
                        </p>
                      )),
                    )}
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
