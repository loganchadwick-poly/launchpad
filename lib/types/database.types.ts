// Database type definitions based on PRD

export type UserRole = 'DS' | 'AD' | 'FDE' | 'Client'

export type UATResult = 
  | 'As Designed - Perfect' 
  | 'As Designed - Imperfect' 
  | 'Fail - Good UX' 
  | 'Fail - Bad UX'

export type IssuePriority = 'High' | 'Medium' | 'Low'

export type IssueStatus = 
  | 'In Progress' 
  | 'Backlogged' 
  | 'Resolved' 
  | 'More Info Needed' 
  | 'Non-Actionable' 
  | 'Accepted for Fix'

export type TicketType = 'UAT' | 'Hypercare' | 'Retest'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  jira_username: string | null
  created_at: string
}

export interface Deployment {
  id: string
  client_name: string
  jira_component: string
  agent_designer_id: string
  forward_deployed_engineer_id: string
  created_at: string
  created_by: string
  // Joined relations
  agent_designer?: User
  forward_deployed_engineer?: User
}

export interface UATSheet {
  id: string
  deployment_id: string
  name: string
  shareable_link_token: string
  created_at: string
  // Joined relations
  deployment?: Deployment
}

export interface UATTestRound {
  id: string
  test_case_id: string
  round_number: number
  tester_name: string
  call_link: string
  result: UATResult | null
  comments: string
  created_at: string
}

export interface UATTestCase {
  id: string
  uat_sheet_id: string
  row_number: number
  test_label: string
  test_script: string
  ready_to_retest: boolean
  polyai_resolution_comments: string
  jira_ticket_id: string | null
  retest_jira_ticket_id: string | null
  created_at: string
  updated_at: string
  // Grouping fields
  parent_row_id: string | null
  group_name: string | null
  group_order: number
  // Joined relations
  uat_sheet?: UATSheet
  rounds?: UATTestRound[]
}

export interface IssueTracker {
  id: string
  deployment_id: string
  name: string
  shareable_link_token: string
  created_at: string
  // Joined relations
  deployment?: Deployment
}

export interface Issue {
  id: string
  issue_tracker_id: string
  date_reported: string
  reported_by: string
  time_of_call: string
  issue_name: string
  call_url: string
  issue_description: string
  priority: IssuePriority
  status: IssueStatus
  expected_fix_date: string | null
  issue_url: string | null
  polyai_notes: string
  jira_ticket_id: string | null
  created_at: string
  updated_at: string
  // Grouping fields
  parent_issue_id: string | null
  group_name: string | null
  group_order: number
  // Joined relations
  issue_tracker?: IssueTracker
}

export interface PendingJiraTicket {
  id: string
  ticket_type: TicketType
  deployment_id: string
  related_row_id: string
  summary: string
  description: string
  priority: string
  assignee_id: string
  epic_name: string
  space: string
  component: string
  created_at: string
  exported: boolean
  // Joined relations
  deployment?: Deployment
  assignee?: User
}

// Form types for creating/updating records
export interface CreateDeploymentInput {
  client_name: string
  jira_component: string
  agent_designer_id: string | null
  forward_deployed_engineer_id: string | null
}

export interface CreateUATSheetInput {
  deployment_id: string
  name: string
}

export interface CreateIssueTrackerInput {
  deployment_id: string
  name: string
}

export interface CreateUserInput {
  email: string
  name: string
  role: UserRole
  jira_username?: string
}
