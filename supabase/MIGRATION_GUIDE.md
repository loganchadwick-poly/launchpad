# Database Migration Guide - Step 2

## 📋 Overview

You have 3 SQL migration files to run in your Supabase dashboard:

1. **001_initial_schema.sql** - Creates all 7 tables with proper relationships
2. **002_rls_policies.sql** - Sets up Row Level Security policies
3. **003_ticket_creation_functions.sql** - Creates automatic JIRA ticket triggers

## 🚀 How to Run the Migrations

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/rpabsxlpzamjoghthplx
2. Click on **SQL Editor** in the left sidebar (icon looks like `</>`)
3. Click **New Query** button

### Step 2: Run Migration 001 - Initial Schema

1. Open the file: `/Users/loganchadwick/uat-platform/supabase/migrations/001_initial_schema.sql`
2. **Copy the entire contents** of the file
3. **Paste** into the SQL Editor in Supabase
4. Click **Run** button (or press Cmd/Ctrl + Enter)
5. ✅ You should see "Success. No rows returned"

**What this creates:**
- ✅ users table
- ✅ deployments table
- ✅ uat_sheets table
- ✅ uat_test_cases table
- ✅ issue_trackers table
- ✅ issues table
- ✅ pending_jira_tickets table
- ✅ Indexes for performance
- ✅ Triggers for updated_at timestamps

### Step 3: Run Migration 002 - RLS Policies

1. Click **New Query** again (or clear the editor)
2. Open: `/Users/loganchadwick/uat-platform/supabase/migrations/002_rls_policies.sql`
3. **Copy entire contents** and paste into SQL Editor
4. Click **Run**
5. ✅ You should see "Success. No rows returned"

**What this creates:**
- ✅ Row Level Security policies for all tables
- ✅ Allows authenticated users to manage internal data
- ✅ Allows public access to shareable links (for clients)
- ✅ Protects sensitive operations

### Step 4: Run Migration 003 - Ticket Creation Functions

1. Click **New Query** again
2. Open: `/Users/loganchadwick/uat-platform/supabase/migrations/003_ticket_creation_functions.sql`
3. **Copy entire contents** and paste into SQL Editor
4. Click **Run**
5. ✅ You should see "Success. No rows returned"

**What this creates:**
- ✅ Function to auto-create JIRA tickets for UAT failures
- ✅ Function to auto-create JIRA tickets for retests
- ✅ Function to auto-create JIRA tickets for issues
- ✅ Triggers that fire when data changes

### Step 5: Verify Tables Were Created

1. Click on **Table Editor** in the left sidebar
2. You should see all 7 tables:
   - users
   - deployments
   - uat_sheets
   - uat_test_cases
   - issue_trackers
   - issues
   - pending_jira_tickets

## ✅ Verification Checklist

After running all migrations, verify:

- [ ] All 7 tables appear in Table Editor
- [ ] No error messages in SQL Editor
- [ ] You can click on each table and see column definitions
- [ ] Green shield icon next to tables (indicates RLS is enabled)

## 🐛 Troubleshooting

### Error: "relation already exists"
- This means you already ran the migration
- Either skip it, or drop the tables first (not recommended unless starting fresh)

### Error: "permission denied"
- Make sure you're using the SQL Editor in Supabase dashboard
- You should be automatically authenticated as the project owner

### Error: "syntax error"
- Make sure you copied the ENTIRE file contents
- Check that nothing was truncated during copy/paste

## 🎯 What's Next?

Once all migrations are successful, your database is fully set up! You're ready for:

**Step 3: Authentication** - Build login/signup pages
**Step 4: Team Management** - Add users and assign roles

---

## 📊 Database Schema Summary

### Tables Created:

1. **users** - Team members (PSM, AD, FDE, Client)
2. **deployments** - Client deployments with team assignments
3. **uat_sheets** - UAT testing sheets with shareable tokens
4. **uat_test_cases** - Individual test cases with results
5. **issue_trackers** - Hypercare issue tracking sheets
6. **issues** - Individual issues during hypercare
7. **pending_jira_tickets** - Simulated JIRA tickets (MVP mode)

### Key Features:

- ✅ Foreign key relationships maintained
- ✅ Cascading deletes where appropriate
- ✅ Automatic timestamp updates
- ✅ Row Level Security enabled
- ✅ Automatic JIRA ticket creation on data changes
- ✅ Shareable link tokens auto-generated
- ✅ Optimized with indexes

Let me know when migrations are complete! 🚀
