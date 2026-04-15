# 🚀 Deployment Guide - UAT & Hypercare Management Platform

## Prerequisites

- [x] Supabase project created and configured
- [x] Database migrations run (all 3 SQL scripts)
- [x] Environment variables set in `.env.local`
- [x] Vercel account (free tier works fine)
- [x] Git repository (optional but recommended)

## Step 1: Prepare Your Supabase Project

### 1.1 Verify Database Schema
Go to Supabase Dashboard → SQL Editor and verify all tables exist:
- `users`
- `deployments`
- `uat_sheets`
- `uat_test_cases`
- `issue_trackers`
- `issues`
- `pending_jira_tickets`

### 1.2 Verify RLS Policies
Go to Database → Tables and check each table has RLS enabled with policies.

### 1.3 Get Your Production Credentials
Go to Project Settings → API:
- Copy **Project URL** (e.g., `https://xxx.supabase.co`)
- Copy **anon/public** key

### 1.4 Configure Auth Settings
Go to Authentication → Settings:
- **Site URL**: Set to your Vercel domain (e.g., `https://your-app.vercel.app`)
- **Redirect URLs**: Add your Vercel domain with `/auth/callback` (e.g., `https://your-app.vercel.app/auth/callback`)

## Step 2: Deploy to Vercel

### 2.1 Push to Git (Recommended)

```bash
cd /Users/loganchadwick/uat-platform

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - UAT Platform MVP"

# Push to GitHub/GitLab/Bitbucket
git remote add origin YOUR_REPO_URL
git push -u origin main
```

### 2.2 Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your Git repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 2.3 Add Environment Variables

In Vercel project settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

⚠️ **Important**: These are the ONLY two environment variables needed!

### 2.4 Deploy

Click **"Deploy"** and wait for build to complete (usually 2-3 minutes).

## Step 3: Post-Deployment Setup

### 3.1 Update Supabase Auth URLs

Once deployed, update Supabase Authentication settings with your Vercel URL:

1. Go to Supabase → Authentication → URL Configuration
2. **Site URL**: `https://your-app.vercel.app`
3. **Redirect URLs**: 
   - `https://your-app.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for local dev)

### 3.2 Test Authentication

1. Visit your deployed app
2. Click "Sign Up"
3. Create a test account
4. Verify you can log in
5. Check Supabase dashboard to see user created

### 3.3 Create Your First User

**Important**: The first user should be a DS!

1. Go to your deployed site
2. Sign up with your work email
3. Select role: **DS**
4. Complete signup

## Step 4: Configure Custom Domain (Optional)

### 4.1 In Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### 4.2 Update Supabase
Update auth URLs to use your custom domain instead of `.vercel.app`

## Step 5: Ongoing Maintenance

### Database Backups
Supabase Pro plan includes automatic backups. Free tier: export manually via Dashboard → Database → Backups.

### Monitor Usage
- Supabase Dashboard → Reports (database size, API calls)
- Vercel Dashboard → Analytics (page views, function calls)

### Updates
To deploy updates:
1. Make changes locally
2. Test locally with `npm run dev`
3. Commit and push to Git
4. Vercel auto-deploys from main branch

## Troubleshooting

### Build Fails on Vercel

**Error: Type errors during build**
- Run `npm run build` locally to see the exact errors
- Fix TypeScript issues
- Push again

**Error: Module not found**
- Ensure all dependencies in `package.json`
- Run `npm install` locally first
- Commit `package-lock.json`

### Auth Not Working After Deploy

**Redirect URL Mismatch**
- Check Supabase auth settings include your Vercel URL
- Clear browser cookies
- Try incognito mode

**"Invalid API key" Error**
- Verify environment variables in Vercel
- Ensure no spaces or quotes in the values
- Redeploy after updating env vars

### Database Connection Issues

**"Could not find table" errors**
- Verify all migrations ran successfully
- Check table names match exactly (lowercase)
- RLS policies must be enabled

### Client Links Not Working

**404 on shared links**
- Check `shareable_link` column exists in tables
- Verify RLS policies allow public access to shared routes
- Test with a fresh incognito window

## Performance Optimization

### For Production Use

1. **Enable Database Connection Pooling** (Supabase Pro)
2. **Add Indexes** for frequently queried columns
3. **Monitor Slow Queries** in Supabase dashboard
4. **Optimize Images** if you add any later
5. **Enable Vercel Analytics** for performance monitoring

### Recommended Indexes (Run in SQL Editor):

```sql
-- Speed up deployment lookups
CREATE INDEX idx_deployments_client_name ON deployments(client_name);

-- Speed up test case queries
CREATE INDEX idx_uat_test_cases_sheet ON uat_test_cases(uat_sheet_id);
CREATE INDEX idx_uat_test_cases_ready_retest ON uat_test_cases(ready_to_retest) WHERE ready_to_retest = true;

-- Speed up issue queries
CREATE INDEX idx_issues_tracker ON issues(issue_tracker_id);
CREATE INDEX idx_issues_status ON issues(status);

-- Speed up pending ticket queries
CREATE INDEX idx_pending_tickets_exported ON pending_jira_tickets(exported) WHERE exported = false;
```

## Security Checklist

- [x] RLS policies enabled on all tables
- [x] Environment variables not committed to Git
- [x] Supabase anon key is public-safe (not service role key!)
- [x] Auth redirect URLs whitelist only your domains
- [x] Database is not publicly accessible (Supabase handles this)
- [ ] Review user roles and permissions
- [ ] Consider enabling MFA for team members (Supabase auth supports this)

## Cost Monitoring

### Supabase Free Tier Limits:
- 500MB database space
- 5GB bandwidth per month
- 50,000 monthly active users
- 2GB file storage

### Vercel Free Tier Limits:
- 100GB bandwidth per month
- 100 deployments per day
- Unlimited projects

**These limits are generous for MVP use! Monitor via dashboards.**

## Backup Strategy

### Recommended Approach:

1. **Weekly Database Export**:
   - Supabase Dashboard → Database → Backups
   - Download SQL dump

2. **Code Backup**:
   - Keep Git repository updated
   - Tag releases: `git tag v1.0.0`

3. **Environment Variables**:
   - Keep a secure copy of `.env.local` (NOT in Git!)
   - Use password manager or secure notes

## Going Live Checklist

- [ ] All migrations run successfully
- [ ] Test account created and working
- [ ] Created at least one deployment
- [ ] Created UAT sheet and issue tracker
- [ ] Tested shareable links (incognito)
- [ ] Verified JIRA ticket generation
- [ ] Tested retest workflow
- [ ] Updated Supabase auth URLs
- [ ] Custom domain configured (if applicable)
- [ ] Team members invited
- [ ] Documentation shared with team
- [ ] Backup strategy in place

## Support and Updates

### For Issues:
1. Check browser console for errors
2. Check Vercel logs (Vercel Dashboard → Deployments → View Function Logs)
3. Check Supabase logs (Dashboard → Logs)

### For Features:
This is an MVP! Future enhancements could include:
- Direct JIRA API integration
- Email notifications
- Slack integration
- Advanced reporting/analytics
- PDF export of UAT sheets
- Bulk test case import

## Success Metrics

Track these to measure platform success:
- Number of deployments managed
- UAT completion rate
- Average time to retest
- Number of issues caught and resolved
- JIRA tickets generated and exported

---

🎉 **Congratulations! Your UAT & Hypercare Management Platform is live!**
