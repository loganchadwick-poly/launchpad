'use client'

import { useState } from 'react'
import { updateDeployment } from '@/app/actions/deployments'

interface User {
  id: string
  name: string
  email: string
}

interface Deployment {
  id: string
  client_name: string
  jira_component: string
  agent_designer_id: string | null
  forward_deployed_engineer_id: string | null
}

interface Props {
  deployment: Deployment
  agentDesigners: User[]
  fdes: User[]
}

export default function EditDeploymentButton({ deployment, agentDesigners, fdes }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.append('id', deployment.id)

    const result = await updateDeployment(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setLoading(false)
      setIsOpen(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-outline inline-flex items-center gap-2 text-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-brand-dark">Edit Deployment</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="client_name" className="block text-sm font-medium text-brand-dark mb-1.5">
                  Client Name
                </label>
                <input
                  type="text"
                  id="client_name"
                  name="client_name"
                  required
                  defaultValue={deployment.client_name}
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="jira_component" className="block text-sm font-medium text-brand-dark mb-1.5">
                  JIRA Component
                </label>
                <input
                  type="text"
                  id="jira_component"
                  name="jira_component"
                  required
                  defaultValue={deployment.jira_component}
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="agent_designer_id" className="block text-sm font-medium text-brand-dark mb-1.5">
                  Agent Designer
                </label>
                <select
                  id="agent_designer_id"
                  name="agent_designer_id"
                  defaultValue={deployment.agent_designer_id || ''}
                  className="input-field"
                >
                  <option value="">-- Not Assigned --</option>
                  {agentDesigners.map((ad) => (
                    <option key={ad.id} value={ad.id}>
                      {ad.name} ({ad.email})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Receives UAT JIRA tickets</p>
              </div>

              <div>
                <label htmlFor="forward_deployed_engineer_id" className="block text-sm font-medium text-brand-dark mb-1.5">
                  Forward Deployed Engineer
                </label>
                <select
                  id="forward_deployed_engineer_id"
                  name="forward_deployed_engineer_id"
                  defaultValue={deployment.forward_deployed_engineer_id || ''}
                  className="input-field"
                >
                  <option value="">-- Not Assigned --</option>
                  {fdes.map((fde) => (
                    <option key={fde.id} value={fde.id}>
                      {fde.name} ({fde.email})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Receives hypercare issue JIRA tickets</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
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
      )}
    </>
  )
}
