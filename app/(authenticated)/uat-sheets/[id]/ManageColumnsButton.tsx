'use client'

// Lets users add/edit/delete custom columns on a UAT sheet without importing
// a file. Core columns are listed as read-only references; only 'custom'
// columns are editable.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addColumn, deleteColumn, updateColumn } from '@/app/actions/uat-columns'
import type { UATColumn, UATColumnDataType, UATColumnLevel } from '@/lib/types/database.types'

interface Props {
  uatSheetId: string
  columnConfig: UATColumn[]
}

export default function ManageColumnsButton({ uatSheetId, columnConfig }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-sm"
      >
        Manage Columns
      </button>
      {open ? (
        <Dialog
          uatSheetId={uatSheetId}
          columnConfig={columnConfig}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

function Dialog({
  uatSheetId,
  columnConfig,
  onClose,
}: {
  uatSheetId: string
  columnConfig: UATColumn[]
  onClose: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const coreColumns = columnConfig.filter((c) => c.kind === 'core')
  const customColumns = columnConfig
    .filter((c) => c.kind === 'custom')
    .sort((a, b) => a.order - b.order)

  // New-column form state
  const [newLabel, setNewLabel] = useState('')
  const [newLevel, setNewLevel] = useState<UATColumnLevel>('case')
  const [newType, setNewType] = useState<UATColumnDataType>('text')
  const [newOptions, setNewOptions] = useState('')

  async function runAction<T>(
    fn: () => Promise<{ success: true } & T | { success: false; error: string }>,
    onOk?: () => void,
  ): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if (res.success) {
        onOk?.()
        router.refresh()
        return true
      }
      setError(res.error)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const ok = await runAction(
      () =>
        addColumn({
          uatSheetId,
          label: newLabel,
          level: newLevel,
          dataType: newType,
          options:
            newType === 'list'
              ? newOptions.split('\n').map((s) => s.trim()).filter(Boolean)
              : undefined,
        }),
      () => {
        setNewLabel('')
        setNewOptions('')
        setNewType('text')
        setNewLevel('case')
      },
    )
    // If add failed, keep the form populated
    void ok
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-brand-dark">Manage Columns</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 px-6 py-5 text-sm">
          {error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {/* Add column */}
          <section>
            <h3 className="mb-2 font-medium text-brand-dark">Add a column</h3>
            <form onSubmit={handleAdd} className="space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
              <div className="flex flex-wrap gap-3">
                <label className="flex-1 min-w-[180px]">
                  <span className="mb-1 block text-xs font-medium text-gray-700">Name</span>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Environment, Priority"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-dark focus:outline-none"
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-700">Level</span>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value as UATColumnLevel)}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-dark focus:outline-none"
                  >
                    <option value="case">Per test case</option>
                    <option value="round">Per test round</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-700">Type</span>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as UATColumnDataType)}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-dark focus:outline-none"
                  >
                    <option value="text">Free text</option>
                    <option value="list">Dropdown</option>
                    <option value="boolean">Checkbox</option>
                  </select>
                </label>
              </div>

              {newType === 'list' ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700">
                    Dropdown options (one per line)
                  </span>
                  <textarea
                    value={newOptions}
                    onChange={(e) => setNewOptions(e.target.value)}
                    placeholder={'Option 1\nOption 2\nOption 3'}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs focus:border-brand-dark focus:outline-none"
                    rows={4}
                  />
                </label>
              ) : null}

              <div className="flex justify-end gap-2">
                <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
                  {busy ? 'Adding…' : 'Add column'}
                </button>
              </div>
            </form>
          </section>

          {/* Existing custom columns */}
          <section>
            <h3 className="mb-2 font-medium text-brand-dark">
              Custom columns {customColumns.length > 0 ? `(${customColumns.length})` : ''}
            </h3>
            {customColumns.length === 0 ? (
              <p className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                No custom columns yet. Add one above, or import a file with custom columns.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 rounded border border-gray-200">
                {customColumns.map((col) => (
                  <li key={col.key}>
                    <CustomColumnRow
                      col={col}
                      busy={busy}
                      onUpdate={(patch) =>
                        runAction(() => updateColumn({ uatSheetId, key: col.key, ...patch }))
                      }
                      onDelete={(stripData) =>
                        runAction(() => deleteColumn({ uatSheetId, key: col.key, stripData }))
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Core columns (read-only) */}
          <section>
            <h3 className="mb-2 font-medium text-brand-dark">Core columns (read-only)</h3>
            <ul className="divide-y divide-gray-100 rounded border border-gray-100 bg-gray-50 text-xs text-gray-600">
              {coreColumns.map((col) => (
                <li key={col.key} className="flex items-center justify-between px-3 py-2">
                  <span>{col.label}</span>
                  <span className="text-[11px] uppercase tracking-wide text-gray-400">
                    {col.level}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-3">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function CustomColumnRow({
  col,
  busy,
  onUpdate,
  onDelete,
}: {
  col: UATColumn
  busy: boolean
  onUpdate: (patch: {
    label?: string
    dataType?: UATColumnDataType
    options?: string[]
  }) => Promise<boolean>
  onDelete: (stripData: boolean) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(col.label)
  const [dataType, setDataType] = useState<UATColumnDataType>(col.dataType ?? 'text')
  const [optionsText, setOptionsText] = useState(
    (col.options ?? []).join('\n'),
  )

  async function save() {
    const options =
      dataType === 'list'
        ? optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
        : undefined
    const ok = await onUpdate({ label, dataType, options })
    if (ok) setEditing(false)
  }

  async function cancel() {
    setLabel(col.label)
    setDataType(col.dataType ?? 'text')
    setOptionsText((col.options ?? []).join('\n'))
    setEditing(false)
  }

  async function handleDelete() {
    const strip = confirm(
      `Delete column "${col.label}"?\n\nClick OK to also erase the values stored in this column on every row. Click Cancel to keep the data (you can re-add the column later to restore it).`,
    )
    // Convention here: we always proceed with the delete; `strip` just
    // distinguishes "hard erase" vs "hide only". A "Cancel" on the dialog
    // above falls through to hide-only, which is the safer default.
    await onDelete(strip)
  }

  if (editing) {
    return (
      <div className="space-y-3 bg-gray-50 p-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 min-w-[180px]">
            <span className="mb-1 block text-xs font-medium text-gray-700">Name</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-dark focus:outline-none"
              maxLength={80}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-gray-700">Type</span>
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value as UATColumnDataType)}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-dark focus:outline-none"
            >
              <option value="text">Free text</option>
              <option value="list">Dropdown</option>
              <option value="boolean">Checkbox</option>
            </select>
          </label>
        </div>
        {dataType === 'list' ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700">
              Dropdown options (one per line)
            </span>
            <textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs focus:border-brand-dark focus:outline-none"
              rows={4}
            />
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn-primary text-sm disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-brand-dark">{col.label}</p>
        <p className="text-[11px] uppercase tracking-wide text-gray-400">
          {col.level} · {col.dataType ?? 'text'}
          {col.dataType === 'list' && col.options?.length
            ? ` · ${col.options.length} option${col.options.length === 1 ? '' : 's'}`
            : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy}
          className="text-xs text-gray-600 hover:text-brand-dark disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
