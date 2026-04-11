'use client'

import { usePathname } from 'next/navigation'

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Home',
  '/deployments': 'Deployments',
  '/deployments/new': 'New Deployment',
  '/issue-trackers': 'Issue Trackers',
  '/jira-tickets': 'JIRA Tickets',
  '/team': 'Team',
}

export function TopBar() {
  const pathname = usePathname()

  // Derive breadcrumb from pathname
  const getBreadcrumb = () => {
    if (breadcrumbMap[pathname]) return breadcrumbMap[pathname]

    // Handle dynamic routes like /deployments/[id], /uat-sheets/[id], /issue-trackers/[id]
    if (pathname.startsWith('/deployments/')) return 'Deployment Details'
    if (pathname.startsWith('/uat-sheets/')) return 'UAT Sheet'
    if (pathname.startsWith('/issue-trackers/')) return 'Issue Tracker'

    return 'Home'
  }

  return (
    <header className="flex h-14 items-center border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-brand-dark">{getBreadcrumb()}</span>
      </div>
    </header>
  )
}
