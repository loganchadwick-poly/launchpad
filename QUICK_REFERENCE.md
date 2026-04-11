# ⚡ Quick Reference - UAT Platform

## 🚀 Deploy in 4 Commands

```bash
# 1. Test locally
npm run build

# 2. Push to Git
git add . && git commit -m "Production ready" && git push

# 3. Import to Vercel (vercel.com/new)
# Add these 2 env vars:
#   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# 4. Update Supabase auth URL to your Vercel domain
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview & quick start |
| `DEPLOYMENT_GUIDE.md` | Complete deployment instructions |
| `TESTING_CHECKLIST.md` | 200+ tests to verify |
| `PRODUCTION_SETUP.md` | Production configuration |
| `PROJECT_COMPLETE.md` | Full project summary |
| `.env.local` | Environment variables (not in Git!) |

---

## 🗄️ Database Setup

Run these in Supabase SQL Editor (in order):

1. `supabase/migrations/001_initial_schema.sql` - Creates tables
2. `supabase/migrations/002_rls_policies.sql` - Security policies
3. `supabase/migrations/003_ticket_creation_functions.sql` - Auto-tickets

Verify: Database → Tables → Should see 7 tables with RLS enabled

---

## 🔐 Environment Variables

Only 2 needed:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

Get from: Supabase Dashboard → Settings → API

⚠️ Use `anon` key, NOT `service_role` key!

---

## 🧪 Quick Test

```bash
npm run dev

# Test these:
# ✓ Sign up (choose PSM role)
# ✓ Create deployment
# ✓ Create UAT sheet
# ✓ Add test case
# ✓ Copy shareable link
# ✓ Open link in incognito
# ✓ Fill out test
# ✓ Check JIRA tickets page
```

---

## 🌐 URLs After Deploy

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | Public | Landing page |
| `/login` | Public | Login |
| `/signup` | Public | Sign up |
| `/dashboard` | Protected | Dashboard |
| `/deployments` | Protected | Deployments |
| `/team` | Protected | Team management |
| `/jira-tickets` | Protected | JIRA tickets |
| `/shared/uat/[link]` | Public | Client UAT testing |
| `/shared/issues/[link]` | Public | Client issue reporting |

---

## 👥 User Roles

| Role | Can Do |
|------|--------|
| **PSM** | Everything (full access) |
| **AD** | View assigned deployments |
| **FDE** | View assigned deployments |
| **Client** | Access via shared links only |

---

## 🎨 Brand Colors

```javascript
// In tailwind.config.js
'brand-lime': '#D9EE50'    // Primary
'brand-dark': '#231F20'    // Text
'brand-white': '#FFFFFF'   // Background
'brand-purple': '#C3AFFE'  // Accent 1
'brand-cyan': '#6FE1EE'    // Accent 2
'brand-coral': '#FF9292'   // Accent 3
```

---

## 🔄 Typical Workflow

1. PSM creates deployment
2. PSM creates UAT sheet + test cases
3. PSM clicks "Share with Client" → copies link
4. PSM sends link to client
5. Client opens link (no login needed)
6. Client fills out test results
7. Failed tests → JIRA tickets auto-created
8. PSM exports tickets to JIRA
9. AD/FDE fixes issues
10. PSM marks "Ready to Retest"
11. Client retests
12. Done! 🎉

---

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Run `npm run build` locally, fix errors |
| Auth doesn't work | Update Supabase redirect URLs |
| Tables not found | Run all 3 migrations in Supabase |
| Shareable links 404 | Check `shareable_link` column exists |
| Can't log in | Clear cookies, try incognito |

---

## 📊 Database Tables

1. **users** - Team members
2. **deployments** - Client deployments
3. **uat_sheets** - UAT testing sheets
4. **uat_test_cases** - Individual test cases
5. **issue_trackers** - Issue tracking sheets
6. **issues** - Individual issues
7. **pending_jira_tickets** - Simulated JIRA tickets

All have RLS (Row Level Security) enabled.

---

## 💰 Costs

### Free Tier (Perfect for MVP)
- Supabase: $0/month
- Vercel: $0/month
- Domain: $12/year (optional)

### At Scale (>50 deployments/month)
- Supabase Pro: $25/month
- Vercel Pro: $20/month per seat
- Total: ~$50-100/month

---

## ✅ Pre-Launch Checklist

- [ ] All 3 migrations run
- [ ] Environment variables set
- [ ] Auth URLs updated
- [ ] Test account created
- [ ] Features tested (use TESTING_CHECKLIST.md)
- [ ] Client links tested (incognito)
- [ ] Team invited
- [ ] Docs shared

---

## 📞 Common Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Start production server (local test)
npm start

# Type checking
npm run type-check

# Lint
npm run lint
```

---

## 🎯 Success Metrics

Track after launch:
- Active users
- Deployments created
- Test completion rate
- JIRA tickets generated
- Time saved vs. Google Sheets

---

## 📖 Full Documentation

- **Getting Started**: README.md
- **Deployment**: DEPLOYMENT_GUIDE.md
- **Testing**: TESTING_CHECKLIST.md
- **Production**: PRODUCTION_SETUP.md
- **Summary**: PROJECT_COMPLETE.md

---

## 🆘 Support

1. Check browser console (F12)
2. Check Vercel logs
3. Check Supabase logs
4. Review DEPLOYMENT_GUIDE.md troubleshooting
5. Test in incognito mode

---

## 🎉 You're Ready!

Everything built, tested, and documented.

**Time to deploy!** 🚀

See DEPLOYMENT_GUIDE.md for step-by-step instructions.

---

*Print this page for quick reference during deployment!*
