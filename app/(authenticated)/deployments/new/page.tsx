import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/getUser'
import { redirect } from 'next/navigation'
import DeploymentForm from './DeploymentForm'

export default async function NewDeploymentPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()

  // Get all Agent Designers and FDEs
  const { data: agentDesigners } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'AD')
    .order('name')

  const { data: fdes } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'FDE')
    .order('name')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-brand-dark">Create New Deployment</h1>
        <p className="mt-1 text-sm text-gray-600">
          Set up a new client deployment with team assignments
        </p>
      </div>

      <DeploymentForm
        agentDesigners={agentDesigners || []}
        fdes={fdes || []}
      />
    </div>
  )
}
