'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createDeployment } from '@/app/actions/deployments'
import type { User } from '@/lib/types/database.types'

interface Props {
  agentDesigners: Pick<User, 'id' | 'name' | 'email'>[]
  fdes: Pick<User, 'id' | 'name' | 'email'>[]
}

export default function DeploymentForm({ agentDesigners, fdes }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const result = await createDeployment(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      } else if (result?.id) {
        router.push(`/deployments/${result.id}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-8">
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Client Name */}
        <div>
          <label htmlFor="client_name" className="block text-sm font-medium text-brand-dark mb-1.5">
            Client Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="client_name"
            name="client_name"
            required
            className="input-field"
            placeholder="e.g., Acme Corporation"
          />
          <p className="mt-1 text-xs text-gray-500">The name of the client for this deployment</p>
        </div>

        {/* JIRA Component */}
        <div>
          <label htmlFor="jira_component" className="block text-sm font-medium text-brand-dark mb-1.5">
            JIRA Component <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="jira_component"
            name="jira_component"
            required
            className="input-field"
            placeholder="e.g., Acme Voice Agent"
          />
          <p className="mt-1 text-xs text-gray-500">The JIRA component name for this deployment</p>
        </div>

        {/* Agent Designer */}
        <div>
          <label htmlFor="agent_designer_id" className="block text-sm font-medium text-brand-dark mb-1.5">
            Agent Designer (AD) <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <select
            id="agent_designer_id"
            name="agent_designer_id"
            className="input-field"
            defaultValue=""
          >
            <option value="">None (assign later)</option>
            {agentDesigners.map((ad) => (
              <option key={ad.id} value={ad.id}>
                {ad.name} ({ad.email})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Will receive UAT-related JIRA tickets when assigned</p>
        </div>

        {/* Forward Deployed Engineer */}
        <div>
          <label htmlFor="forward_deployed_engineer_id" className="block text-sm font-medium text-brand-dark mb-1.5">
            Forward Deployed Engineer (FDE) <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <select
            id="forward_deployed_engineer_id"
            name="forward_deployed_engineer_id"
            className="input-field"
            defaultValue=""
          >
            <option value="">None (assign later)</option>
            {fdes.map((fde) => (
              <option key={fde.id} value={fde.id}>
                {fde.name} ({fde.email})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Will receive hypercare issue JIRA tickets when assigned</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 pt-6">
          <Link href="/deployments" className="btn-outline flex-1 text-center">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Deployment'}
          </button>
        </div>
      </div>
    </form>
  )
}
