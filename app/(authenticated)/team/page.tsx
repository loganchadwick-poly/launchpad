import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/getUser'
import AddTeamMemberButton from './AddTeamMemberButton'
import TeamMemberRow from './TeamMemberRow'

export default async function TeamPage() {
  await getUser() // Ensure user is authenticated
  const supabase = await createClient()

  // Get all users
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  // Group by role
  const usersByRole = {
    PSM: users?.filter(u => u.role === 'PSM') || [],
    AD: users?.filter(u => u.role === 'AD') || [],
    FDE: users?.filter(u => u.role === 'FDE') || [],
    Client: users?.filter(u => u.role === 'Client') || [],
  }

  const totalUsers = users?.length || 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-brand-dark">Team Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your team members and their roles
          </p>
        </div>
        <AddTeamMemberButton />
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-4">
          <p className="text-2xl font-semibold text-brand-dark">{totalUsers}</p>
          <p className="text-sm text-gray-600">Total Members</p>
        </div>
        <div className="card border border-gray-200 bg-white p-4">
          <p className="text-2xl font-semibold text-brand-dark">{usersByRole.PSM.length}</p>
          <p className="text-sm text-gray-700 font-medium">PSM</p>
        </div>
        <div className="card border border-gray-200 bg-white p-4">
          <p className="text-2xl font-semibold text-brand-dark">{usersByRole.AD.length}</p>
          <p className="text-sm text-gray-700 font-medium">Agent Designers</p>
        </div>
        <div className="card border border-gray-200 bg-white p-4">
          <p className="text-2xl font-semibold text-brand-dark">{usersByRole.FDE.length}</p>
          <p className="text-sm text-gray-700 font-medium">FDE</p>
        </div>
        <div className="card border border-gray-200 bg-white p-4">
          <p className="text-2xl font-semibold text-brand-dark">{usersByRole.Client.length}</p>
          <p className="text-sm text-gray-700 font-medium">Clients</p>
        </div>
      </div>

      {/* Team Members Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  JIRA Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Added
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users && users.length > 0 ? (
                users.map((user) => (
                  <TeamMemberRow key={user.id} user={user} />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                        <svg
                          className="h-6 w-6 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                      <h3 className="mt-3 text-sm font-medium text-gray-900">No team members yet</h3>
                      <p className="mt-1 text-sm text-gray-500">Get started by adding your first team member</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 card border-2 border-gray-300 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-brand-dark">Team Member Roles</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 text-sm text-gray-700">
          <li><strong className="text-brand-dark">PSM:</strong> Creates deployments and manages projects</li>
          <li><strong className="text-brand-dark">AD:</strong> Assigned to UAT testing, receives UAT tickets</li>
          <li><strong className="text-brand-dark">FDE:</strong> Assigned to hypercare, receives issue tickets</li>
          <li><strong className="text-brand-dark">Client:</strong> External users who access via shareable links</li>
        </ul>
      </div>
    </div>
  )
}
