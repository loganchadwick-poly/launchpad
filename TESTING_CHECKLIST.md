# ✅ Testing Checklist - UAT & Hypercare Management Platform

Use this checklist to thoroughly test your platform before going live.

## 🔐 Authentication & User Management

### Sign Up
- [ ] Can create account with email/password
- [ ] Can select role (DS/AD/FDE/Client)
- [ ] Receives appropriate error for invalid email
- [ ] Receives appropriate error for weak password
- [ ] User appears in Supabase Auth dashboard
- [ ] User row created in `users` table

### Login
- [ ] Can log in with correct credentials
- [ ] Cannot log in with wrong password
- [ ] Redirects to dashboard after login
- [ ] User info displays correctly (name, email, role)

### Logout
- [ ] Logout button works
- [ ] Redirects to login page
- [ ] Cannot access protected routes after logout

## 👥 Team Management

### View Team
- [ ] Team page loads successfully
- [ ] Displays all users with correct roles
- [ ] Role badges are color-coded correctly
- [ ] Shows user count

### Add Team Member
- [ ] "Add Team Member" modal opens
- [ ] Can enter name, email, role
- [ ] Form validation works (required fields)
- [ ] New member appears in list immediately
- [ ] New member can log in with their credentials

### Edit Team Member
- [ ] Edit button shows editable fields inline
- [ ] Can update name
- [ ] Can update email
- [ ] Can change role
- [ ] Changes save automatically
- [ ] Cancel button reverts changes

### Delete Team Member
- [ ] Delete button shows confirmation
- [ ] Confirmation prevents accidental deletion
- [ ] Member removed from list
- [ ] Member removed from database

## 🏢 Deployment Management

### Create Deployment
- [ ] "New Deployment" page loads
- [ ] Form has all required fields
- [ ] Client name is required
- [ ] JIRA Component is required
- [ ] Can select AD from dropdown (populated from team)
- [ ] Can select FDE from dropdown (populated from team)
- [ ] Deployment created successfully
- [ ] Redirects to deployment detail page

### View Deployments
- [ ] Deployments page lists all deployments
- [ ] Shows client name, ID, and team
- [ ] Filter by status works
- [ ] Quick stats display correctly
- [ ] Can click to view details

### Deployment Details
- [ ] Shows deployment information
- [ ] Shows assigned AD and FDE
- [ ] "Create UAT Sheet" button works
- [ ] "Create Issue Tracker" button works
- [ ] Lists associated UAT sheets
- [ ] Lists associated issue trackers

## 📋 UAT Sheet Management

### Create UAT Sheet
- [ ] Modal opens from deployment page
- [ ] Can enter sheet name
- [ ] Can select test type
- [ ] Sheet created successfully
- [ ] Shareable link generated automatically
- [ ] Sheet appears in deployment details

### UAT Sheet Detail Page (DS View)
- [ ] Sheet loads with correct info
- [ ] "Share with Client" button visible
- [ ] Copy link works with visual feedback
- [ ] "Add Test Case" button works
- [ ] Test cases table displays correctly
- [ ] Stats show (Total/Passed/Failed/Ready to Retest/Retest Passed/Retest Failed)

### Add Test Case
- [ ] Modal form opens
- [ ] Can enter test label
- [ ] Can enter test script
- [ ] Test case appears in table immediately
- [ ] Row numbers auto-increment

### Edit Test Case (DS)
- [ ] Click test name to expand
- [ ] All fields editable
- [ ] Changes save on blur
- [ ] Result dropdown works
- [ ] "Ready to Retest" checkbox works
- [ ] Retest section appears when ready_to_retest is checked
- [ ] Delete button works with confirmation

## 🌐 Client UAT Access (Shareable Links)

### Access Shared Link
- [ ] Can open link without login (incognito test)
- [ ] Welcome message displays
- [ ] Stats dashboard shows correct counts
- [ ] Test cases display in card layout
- [ ] Test cases show correct status

### Test a Case (Initial Test)
- [ ] Click "Test" to expand
- [ ] See 4 result buttons (Perfect/Imperfect/Fail Good UX/Fail Bad UX)
- [ ] Can click result button
- [ ] Result saves and badge updates
- [ ] Can enter name
- [ ] Can enter phone
- [ ] Can enter comments
- [ ] Call URL field appears for failures
- [ ] Stats update in real-time
- [ ] "Saving..." indicator appears

### Retest a Case
- [ ] DS marks test as "Ready to Retest"
- [ ] Refresh client view
- [ ] "Ready to Retest" badge appears
- [ ] Click test shows "Ready for retesting" banner
- [ ] See original test result for context
- [ ] Can enter retest result
- [ ] Can enter retester name
- [ ] Can enter retest comments/feedback
- [ ] Retest call URL field appears for failures
- [ ] Stats update to show retest counts

## 🚨 Issue Tracker Management

### Create Issue Tracker
- [ ] Modal opens from deployment page
- [ ] Can enter tracker name
- [ ] Tracker created successfully
- [ ] Shareable link generated
- [ ] Tracker appears in deployment details

### Issue Tracker Detail Page (DS View)
- [ ] Tracker loads with correct info
- [ ] "Share with Client" button visible
- [ ] Copy link works
- [ ] "Add Issue" button works
- [ ] Stats show (Total/High Priority/In Progress/Resolved)
- [ ] Issues display in table

### Add Issue (DS)
- [ ] Modal opens
- [ ] Can enter issue name (required)
- [ ] Can enter description
- [ ] Can enter reported by (required)
- [ ] Can select priority
- [ ] Can enter date/time
- [ ] Can enter call URL
- [ ] Issue created successfully
- [ ] Appears in table immediately

### Edit Issue (DS)
- [ ] Click issue name to expand
- [ ] All fields editable inline
- [ ] Priority dropdown works
- [ ] Status dropdown works (6 options)
- [ ] Expected fix date picker works
- [ ] Changes save automatically
- [ ] Delete button works with confirmation

## 🌐 Client Issue Access (Shareable Links)

### Access Shared Link
- [ ] Can open link without login (incognito)
- [ ] Welcome message displays
- [ ] "Report an Issue" button prominent
- [ ] Stats dashboard shows counts
- [ ] Existing issues display in cards

### Report Issue
- [ ] Click "Report an Issue"
- [ ] Modal opens with form
- [ ] Issue name required
- [ ] Description required
- [ ] Reporter name required
- [ ] Priority dropdown works
- [ ] Date/time fields work
- [ ] Can add call URL
- [ ] Submit works
- [ ] Success message displays
- [ ] Issue appears in list

### View Issues
- [ ] Can expand issue to see details
- [ ] Priority badges color-coded
- [ ] Status badges color-coded
- [ ] Can see description
- [ ] Can see reporter info
- [ ] Can see call recording link
- [ ] Shows resolution status
- [ ] "Resolved" issues show green banner

## 🎫 JIRA Ticket Simulation

### Tickets Page
- [ ] `/jira-tickets` page loads
- [ ] Shows pending tickets count
- [ ] Shows stats by type (UAT/Issue/Retest)
- [ ] Lists pending tickets
- [ ] Lists recently exported tickets (if any)
- [ ] Info banner explains simulation mode

### Ticket Cards
- [ ] Tickets color-coded by type (lime/coral/cyan)
- [ ] Shows client name and JIRA Component
- [ ] Shows creation timestamp
- [ ] Click to expand works

### Ticket Details
- [ ] Formatted ticket text displays in code block
- [ ] Copy button works with visual feedback
- [ ] "Mark as Exported" button works
- [ ] Confirmation dialog appears
- [ ] Ticket moves to "Recently Exported" section
- [ ] Shows export timestamp
- [ ] Delete button works (for pending only)

### Auto-Generation
- [ ] UAT test marked "Fail" creates ticket
- [ ] New issue reported creates ticket
- [ ] Retest marked "Fail" creates ticket
- [ ] Tickets appear immediately in list
- [ ] Ticket text is properly formatted

## 📊 Dashboard

### Stats Display
- [ ] Deployments count correct
- [ ] UAT Sheets count correct
- [ ] Issue Trackers count correct
- [ ] Pending Tickets count correct
- [ ] Icons display properly

### Quick Actions
- [ ] "New Deployment" card links correctly
- [ ] "Manage Team" card links correctly
- [ ] "View Pending Tickets" card links correctly
- [ ] Getting Started section shows for new users

## 🎨 UI/UX

### Visual Design
- [ ] Brand colors display correctly (lime/dark/purple/cyan/coral)
- [ ] Navigation bar styled properly
- [ ] Cards have proper shadows and borders
- [ ] Buttons have hover states
- [ ] Forms are properly styled
- [ ] Text is readable (contrast)
- [ ] Icons are consistent

### Mobile Responsive
- [ ] Test on phone (iPhone/Android)
- [ ] Navigation works on mobile
- [ ] Forms are usable on mobile
- [ ] Tables scroll horizontally if needed
- [ ] Buttons are tappable (not too small)
- [ ] Text is readable on small screens

### Loading States
- [ ] "Loading..." or spinners show during actions
- [ ] Disabled states work (buttons greyed out)
- [ ] "Saving..." indicators appear
- [ ] No UI jank or layout shifts

## 🔄 Data Persistence

### Refresh Test
- [ ] Fill out a form
- [ ] Refresh page
- [ ] Data persists (saved to database)

### Multiple Tabs
- [ ] Open same page in two tabs
- [ ] Make change in one tab
- [ ] Refresh other tab
- [ ] Change appears (via database)

## 🚨 Error Handling

### Network Errors
- [ ] Disconnect internet
- [ ] Try to perform action
- [ ] Appropriate error message shows
- [ ] App doesn't crash

### Form Validation
- [ ] Submit empty required fields
- [ ] See validation errors
- [ ] Fix errors
- [ ] Form submits successfully

### 404 Pages
- [ ] Visit non-existent route
- [ ] See appropriate 404 page
- [ ] Can navigate back

## 🔒 Security

### Route Protection
- [ ] Cannot access `/dashboard` when logged out
- [ ] Cannot access `/team` when logged out
- [ ] Cannot access `/deployments` when logged out
- [ ] Redirects to login page

### Public Routes
- [ ] Can access `/shared/uat/[link]` without login
- [ ] Can access `/shared/issues/[link]` without login
- [ ] Can access `/login` and `/signup` without login

### Data Isolation
- [ ] Users only see data they have permission for
- [ ] RLS policies enforced
- [ ] Cannot access other client's data via URL manipulation

## 📝 Edge Cases

### Empty States
- [ ] Dashboard shows properly with no data
- [ ] Deployments page shows empty state
- [ ] Team page handles 1 user (yourself)
- [ ] JIRA tickets page shows "All caught up" when empty

### Special Characters
- [ ] Can enter special characters in names
- [ ] Can enter apostrophes and quotes
- [ ] URLs with spaces handled
- [ ] Emoji don't break anything (if entered)

### Long Text
- [ ] Long client names display properly
- [ ] Long descriptions don't break layout
- [ ] Text wraps or truncates appropriately

## ✅ Final Checks

- [ ] All pages load without console errors
- [ ] All links work (no 404s)
- [ ] All buttons do something
- [ ] All forms submit successfully
- [ ] No TypeScript errors
- [ ] No linter warnings
- [ ] Tested in Chrome
- [ ] Tested in Safari
- [ ] Tested in Firefox
- [ ] Tested on mobile device

---

## 🎉 Once All Checks Pass:

**You're ready to go live!**

Share the platform with your team and start managing UAT testing and hypercare issues like a pro!
