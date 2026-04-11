'use client'

import { useState } from 'react'
import { updateTeamMember, deleteTeamMember } from '@/app/actions/team'
import type { User } from '@/lib/types/database.types'

const roleColors = {
  PSM: 'bg-gray-100 text-gray-800 border-gray-300',
  AD: 'bg-gray-100 text-gray-800 border-gray-300',
  FDE: 'bg-gray-100 text-gray-800 border-gray-300',
  Client: 'bg-gray-100 text-gray-800 border-gray-300',
}

export default function TeamMemberRow({ user }: { user: User }) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.append('id', user.id)

    const result = await updateTeamMember(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setIsEditing(false)
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete ${user.name}?`)) {
      return
    }

    setLoading(true)
    const result = await deleteTeamMember(user.id)

    if (result?.error) {
      alert(result.error)
      setLoading(false)
    }
  }

  const formattedDate = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-6 py-4">
        <div className="text-sm font-medium text-brand-dark">{user.name}</div>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <div className="text-sm text-gray-600">{user.email}</div>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${roleColors[user.role]}`}>
          {user.role}
        </span>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <div className="text-sm text-gray-600">{user.jira_username || '-'}</div>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <div className="text-sm text-gray-600">{formattedDate}</div>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right">
        <button
          onClick={() => setIsEditing(true)}
          className="mr-4 text-sm font-medium text-brand-dark hover:underline"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-sm font-medium text-red-600 hover:text-red-700"
        >
          Delete
        </button>
      </td>

      {/* Edit Modal */}
      {isEditing && (
        <td colSpan={6} className="absolute inset-0 z-50">
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-brand-dark">Edit Team Member</h2>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1.5">Email</label>
                  <input
                    type="text"
                    value={user.email}
                    disabled
                    className="input-field bg-gray-50 text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                </div>

                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-brand-dark mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="edit-name"
                    name="name"
                    defaultValue={user.name}
                    required
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="edit-role" className="block text-sm font-medium text-brand-dark mb-1.5">
                    Role
                  </label>
                  <select
                    id="edit-role"
                    name="role"
                    defaultValue={user.role}
                    required
                    className="input-field"
                  >
                    <option value="PSM">PSM</option>
                    <option value="AD">AD</option>
                    <option value="FDE">FDE</option>
                    <option value="Client">Client</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-jira" className="block text-sm font-medium text-brand-dark mb-1.5">
                    JIRA Username <span className="text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="edit-jira"
                    name="jira_username"
                    defaultValue={user.jira_username || ''}
                    className="input-field"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </td>
      )}
    </tr>
  )
}
