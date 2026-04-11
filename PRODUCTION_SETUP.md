# Production Environment Setup Guide 🏭

This guide walks you through setting up the production environment for your UAT & Hypercare Management Platform.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Supabase account with a project created
- [ ] All 3 database migrations run successfully
- [ ] Vercel account (free tier is fine)
- [ ] Git repository (GitHub, GitLab, or Bitbucket)
- [ ] Domain name (optional but recommended)
- [ ] Your company logo/branding assets

## Step 1: Supabase Production Setup

### 1.1 Create Production Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose a name: e.g., `uat-platform-production`
4. Set a strong database password (save it securely!)
5. Choose a region close to your users
6. Wait ~2 minutes for provisioning

### 1.2 Run Database Migrations

Go to SQL Editor in Supabase Dashboard and run these in order:

**Migration 1: Schema** (`supabase/migrations/001_initial_schema.sql`)
```sql
-- Creates all 7 tables with relationships
-- Run the entire contents of this file
```

**Migration 2: RLS Policies** (`supabase/migrations/002_rls_policies.sql`)
```sql
-- Sets up Row Level Security
-- Run the entire contents of this file
```

**Migration 3: JIRA Functions** (`supabase/migrations/003_ticket_creation_functions.sql`)
```sql
-- Creates triggers for auto-ticket generation
-- Run the entire contents of this file
```

### 1.3 Verify Database Setup

1. Go to Database → Tables
2. Verify all 7 tables exist:
   - ✅ users
   - ✅ deployments
   - ✅ uat_sheets
   - ✅ uat_test_cases
   - ✅ issue_trackers
   - ✅ issues
   - ✅ pending_jira_tickets

3. Click each table and verify RLS is enabled (green shield icon)

### 1.4 Configure Authentication

Go to Authentication → Settings:

**Email Settings:**
- Enable email confirmation: Optional (turn off for easier signup)
- Email templates: Customize with your branding

**URL Configuration** (update after deployment):
- Site URL: `https://your-domain.com` (or `.vercel.app` URL)
- Redirect URLs: `https://your-domain.com/auth/callback`

### 1.5 Get API Credentials

Go to Settings → API:

Copy these values:
```
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbGciOiJI...
```

⚠️ **Important**: Use the `anon` key, NOT the `service_role` key!

## Step 2: Prepare Code for Deployment

### 2.1 Environment Variables

Create `.env.local` (DO NOT commit this file!):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 2.2 Test Locally First

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Test in browser at localhost:3000
# - Sign up
# - Create deployment
# - Test shareable links (incognito)
```

### 2.3 Build Test

```bash
# Test production build locally
npm run build

# Should complete without errors
# Fix any TypeScript or build errors
```

### 2.4 Git Setup

```bash
# Initialize repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - UAT Platform"

# Create GitHub repository and push
git remote add origin https://github.com/your-username/uat-platform.git
git push -u origin main
```

## Step 3: Deploy to Vercel

### 3.1 Import Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your repository
4. Click "Import"

### 3.2 Configure Build Settings

Vercel auto-detects Next.js. Verify:

- **Framework Preset**: Next.js
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 3.3 Add Environment Variables

In the "Environment Variables" section, add:

```
NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY  
Value: eyJhbGciOiJI... (your anon key)
```

**Important**: Add to all environments (Production, Preview, Development)

### 3.4 Deploy

1. Click "Deploy"
2. Wait 2-3 minutes
3. Get your deployment URL: `https://your-app.vercel.app`

## Step 4: Post-Deployment Configuration

### 4.1 Update Supabase Auth URLs

Go back to Supabase → Authentication → URL Configuration:

Update with your Vercel URL:
```
Site URL: https://your-app.vercel.app
Redirect URLs:
  - https://your-app.vercel.app/auth/callback
  - http://localhost:3000/auth/callback (keep for local dev)
```

### 4.2 Test Production App

1. Visit your Vercel URL
2. Sign up with your email (PSM role)
3. Verify email works (check spam folder)
4. Log in successfully
5. Create a test deployment

### 4.3 Test Client Access

1. Create a UAT sheet
2. Copy shareable link
3. Open in incognito window
4. Verify client can access and fill out tests
5. Verify JIRA ticket created on failure

## Step 5: Custom Domain (Optional)

### 5.1 Add Domain in Vercel

1. Go to Project Settings → Domains
2. Click "Add"
3. Enter your domain: `uat-platform.yourcompany.com`

### 5.2 Configure DNS

Add these DNS records in your domain provider:

**For subdomain** (uat-platform.yourcompany.com):
```
Type: CNAME
Name: uat-platform
Value: cname.vercel-dns.com
```

**For apex domain** (yourcompany.com):
```
Type: A
Name: @
Value: 76.76.21.21
```

### 5.3 Update Supabase Again

Go back to Supabase → Authentication → URL Configuration:

Update with custom domain:
```
Site URL: https://uat-platform.yourcompany.com
Redirect URLs: https://uat-platform.yourcompany.com/auth/callback
```

### 5.4 Force HTTPS

Vercel automatically provides SSL certificate. Verify:
1. Visit http://your-domain.com
2. Should auto-redirect to https://

## Step 6: Team Onboarding

### 6.1 Create Admin Account

Your first account should be PSM role for full access.

### 6.2 Invite Team Members

1. Go to Team page
2. Add team members:
   - Agent Designers (AD)
   - FDEs
   - Other PSMs

### 6.3 Send Credentials

Team members need:
- Platform URL
- Their email address (they set password on first login)
- Link to documentation

## Step 7: Security Hardening

### 7.1 Database Security

✅ RLS policies enabled (done in migrations)
✅ Only anon key exposed (not service_role)
✅ Environment variables secured

### 7.2 Supabase Security

Go to Supabase → Authentication → Policies:

- [ ] Consider enabling email confirmation
- [ ] Set password requirements (min length, complexity)
- [ ] Enable MFA (optional)

### 7.3 Vercel Security

- [ ] Enable "Vercel Authentication" for preview deployments
- [ ] Set up monitoring and alerts
- [ ] Review function logs periodically

## Step 8: Monitoring & Maintenance

### 8.1 Set Up Monitoring

**Vercel Dashboard:**
- Analytics → Page views, function calls
- Logs → View function execution logs
- Metrics → Performance, errors

**Supabase Dashboard:**
- Logs → Database queries, API calls
- Reports → Database size, bandwidth
- Database → Monitor table sizes

### 8.2 Regular Maintenance

**Weekly:**
- [ ] Check error logs
- [ ] Review pending JIRA tickets
- [ ] Monitor database size

**Monthly:**
- [ ] Review user accounts (remove inactive)
- [ ] Check for Supabase/Vercel updates
- [ ] Review usage against free tier limits
- [ ] Export database backup

### 8.3 Database Backups

**Supabase Free Tier**: Manual backups only
1. Go to Database → Backups
2. Click "Create Backup"
3. Download SQL dump

**Supabase Pro**: Automatic daily backups

Store backups securely (encrypted cloud storage).

## Step 9: Troubleshooting Production

### Build Failures

```bash
# Run locally first
npm run build

# Fix any TypeScript errors
# Push fixes to Git
# Vercel auto-redeploys
```

### Auth Issues

- Verify redirect URLs in Supabase match exactly
- Check browser console for CORS errors
- Clear cookies and try again
- Test in incognito mode

### Database Connection Issues

- Check environment variables in Vercel
- Verify Supabase project is not paused (free tier pauses after 1 week inactivity)
- Check RLS policies aren't blocking queries

### Performance Issues

- Check function execution times in Vercel
- Look for slow queries in Supabase logs
- Add database indexes if needed (see DEPLOYMENT_GUIDE.md)

## Step 10: Scaling Considerations

### When to Upgrade

**Supabase Pro** ($25/mo) when you hit:
- 500MB database size
- 5GB bandwidth/month
- Need automatic backups
- Want better performance

**Vercel Pro** ($20/mo per user) when you need:
- More than 100GB bandwidth/month
- Password protection for preview deployments
- Advanced analytics
- Priority support

### Performance Tips

1. Add database indexes for common queries
2. Enable Supabase connection pooling (Pro)
3. Use Vercel Edge Functions for global performance
4. Optimize images (if you add any)
5. Monitor and optimize slow API routes

## Success Metrics to Track

After going live, monitor:

- **User Adoption**: Number of team members using platform
- **Deployment Volume**: Deployments created per month
- **UAT Completion**: Percentage of tests completed by clients
- **Issue Resolution**: Average time from issue to resolution
- **JIRA Efficiency**: Tickets generated vs. manually created
- **Client Satisfaction**: Feedback from clients using shared links

## Production Checklist

Before announcing to the team:

- [ ] All 3 migrations run successfully
- [ ] Environment variables set in Vercel
- [ ] Auth URLs configured in Supabase
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active (https working)
- [ ] Test account created and working
- [ ] Client shareable links tested (incognito)
- [ ] JIRA ticket generation tested
- [ ] Retest workflow tested
- [ ] Team members invited
- [ ] Documentation shared with team
- [ ] Backup strategy in place
- [ ] Monitoring set up
- [ ] Error tracking enabled
- [ ] Support process defined

## Emergency Contacts

Keep this information handy:

- **Supabase Dashboard**: https://app.supabase.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Database Password**: [Store securely in password manager]
- **Supabase Service Role Key**: [NEVER commit to Git, store securely]

## Rolling Back

If something goes wrong:

**Vercel:**
1. Go to Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"

**Database:**
1. Restore from backup (if Pro plan)
2. Or re-run migrations on new project

---

## 🎉 Production Launch Checklist

Use this on launch day:

- [ ] Morning: Deploy to production
- [ ] Test all critical paths
- [ ] Create announcement email with URL and docs
- [ ] Send to team
- [ ] Monitor for issues during first day
- [ ] Be available for questions
- [ ] Gather feedback
- [ ] Celebrate! 🎊

**You're ready for production! Good luck! 🚀**
