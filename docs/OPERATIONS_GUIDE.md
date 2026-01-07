# Operations Guide

> Complete guide for running your restaurant analytics SaaS as a solo operator.
> Last updated: 2026-01-08

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [GitHub Workflow](#github-workflow)
3. [File Organization](#file-organization)
4. [Security Checklist](#security-checklist)
5. [Privacy & Data Handling](#privacy--data-handling)
6. [Backup Strategy](#backup-strategy)
7. [Incident Response](#incident-response)
8. [Client Onboarding](#client-onboarding)
9. [Development Workflow](#development-workflow)

---

## Daily Operations

### Morning Routine (5-10 min)

```
1. Check production health
   - Visit: https://musical-spotted-invention-production.up.railway.app/health
   - Verify: status = "healthy"

2. Check auto-fetch status
   - Login as operator
   - Go to Data Management → Import History
   - Verify today's auto-import completed (if scheduled)

3. Quick dashboard scan
   - Switch to each tenant
   - Verify dashboards loading
   - Check for any alerts
```

### Weekly Review (Friday, 30 min)

```
1. GitHub Issues
   - Review open issues
   - Close completed items
   - Reprioritize if needed
   - Plan next week's focus

2. Client Health Check
   - Review each tenant's data freshness
   - Check for stale imports (>24h old)
   - Note any client-specific issues

3. Update BACKLOG.md
   - Add new ideas/feedback
   - Remove completed items
   - Adjust priorities
```

---

## GitHub Workflow

### Creating an Issue

1. Go to: https://github.com/dannyboy637/musical-spotted-invention/issues
2. Click **"New issue"**
3. Fill in:
   - **Title**: Short, descriptive (e.g., "Bug: Top items by branch missing item names")
   - **Description**: Use templates below
   - **Labels**: Select appropriate labels (right sidebar)
4. Click **"Submit new issue"**

### Issue Templates

**Bug Report:**
```markdown
## Description
[What's broken]

## Steps to Reproduce
1. Go to [page]
2. [Do action]
3. See [problem]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Role: operator/owner/viewer
- Tenant: [which tenant]
- Browser: [Chrome/Safari/etc]
```

**Enhancement:**
```markdown
## Problem
[What problem does this solve?]

## Proposed Solution
[How should it work?]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```

### Working on an Issue

1. **Assign yourself**: Click "Assignees" → select your name
2. **Start work**: Comment "Starting work on this"
3. **Reference in commits**: Include `#123` in commit messages
4. **Close when done**: Comment "Fixed in [commit]" → Close issue

### Issue Lifecycle

```
Open → In Progress → Done
  │         │          │
  │         │          └── Close issue, reference commit
  │         └── Assign yourself, comment "Starting"
  └── Create with labels
```

### Keyboard Shortcuts (GitHub Web)

| Key | Action |
|-----|--------|
| `c` | Create new issue |
| `l` | Open label selector |
| `a` | Open assignee selector |
| `/` | Focus search bar |
| `?` | Show all shortcuts |

---

## File Organization

### Project Structure

```
restaurant-analytics/
├── .env                    # LOCAL ONLY - never commit
├── .gitignore              # Ensures secrets aren't committed
├── CLAUDE.md               # Instructions for Claude Code
│
├── backend/
│   ├── .env                # Backend secrets - LOCAL ONLY
│   ├── main.py             # Entry point
│   ├── routes/             # API endpoints
│   ├── modules/            # Business logic
│   ├── services/           # External services (email, AI)
│   ├── scripts/            # CLI tools, cron scripts
│   └── migrations/         # Database migrations (SQL)
│
├── frontend/
│   ├── .env                # Frontend env vars - LOCAL ONLY
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── modules/        # Feature pages
│   │   ├── stores/         # Zustand state
│   │   ├── hooks/          # React Query hooks
│   │   └── lib/            # Utilities
│   └── dist/               # Build output - gitignored
│
└── docs/
    ├── CURRENT_CONTEXT.md  # Session context for Claude
    ├── BACKLOG.md          # Organized feature/bug list
    ├── OPERATIONS_GUIDE.md # This file
    ├── GITHUB_WORKFLOW.md  # GitHub quick reference
    ├── API.md              # API documentation
    ├── DEPLOYMENT.md       # Deployment guide
    ├── ONBOARDING_CHECKLIST.md
    ├── CLIENT_WELCOME_GUIDE.md
    └── archive/specs/      # Completed phase specs
```

### What Goes Where

| Type | Location | Notes |
|------|----------|-------|
| Secrets/credentials | `.env` files | NEVER commit |
| API keys | Railway/Vercel env vars | Set in dashboard |
| Database changes | `backend/migrations/` | Run manually in Supabase |
| New features | Create in appropriate `modules/` folder | |
| Shared components | `frontend/src/components/` | |
| Documentation | `docs/` | |
| Temporary files | Don't commit | Add to `.gitignore` |

### Files to NEVER Commit

```
.env
.env.local
.env.production
*.pem
*.key
credentials.json
service-account.json
```

---

## Security Checklist

### Environment Variables

| Variable | Where to Set | Notes |
|----------|--------------|-------|
| `SUPABASE_URL` | Railway, Vercel | Database URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway only | NEVER expose to frontend |
| `SUPABASE_ANON_KEY` | Vercel (frontend) | Safe for frontend |
| `SUPABASE_JWT_SECRET` | Railway | For JWT validation |
| `AUTO_FETCH_SECRET` | Railway | Protects auto-fetch endpoint |
| `STOREHUB_*` | Railway | StoreHub credentials |

### Security Best Practices

1. **Never commit secrets**
   - Check `.gitignore` includes all `.env` files
   - If accidentally committed, rotate keys immediately

2. **Use environment variables**
   - Production secrets in Railway/Vercel dashboards
   - Local secrets in `.env` files (gitignored)

3. **API Security**
   - All endpoints require JWT authentication
   - RLS policies enforce tenant isolation
   - Rate limiting: 100 req/min per user

4. **Database Security**
   - Row Level Security (RLS) on all tables
   - Service role key only on backend
   - Anon key has limited permissions

5. **Auto-fetch endpoint**
   - Protected by `AUTO_FETCH_SECRET` token
   - Only accepts requests with valid token

### Monthly Security Review

```
[ ] Rotate any exposed credentials
[ ] Review Railway/Vercel access logs
[ ] Check Supabase auth logs for anomalies
[ ] Verify RLS policies still active
[ ] Update dependencies (npm audit, pip audit)
```

---

## Privacy & Data Handling

### Data Classification

| Type | Sensitivity | Handling |
|------|-------------|----------|
| Transaction data | High | Tenant-isolated, RLS protected |
| User emails | High | Stored in Supabase Auth |
| Passwords | Critical | Handled by Supabase (hashed) |
| Analytics (aggregated) | Medium | Tenant-isolated |
| App settings | Low | User-specific |

### Tenant Data Isolation

- **Database**: RLS policies filter by `tenant_id`
- **API**: JWT middleware extracts tenant context
- **Frontend**: Tenant switcher only for operators
- **Storage**: CSV uploads tagged with `tenant_id`

### Client Data Requests

If a client asks for their data:
1. Export from Supabase: `SELECT * FROM transactions WHERE tenant_id = 'xxx'`
2. Include: transactions, menu_items, alerts, reports
3. Deliver securely (encrypted email or secure link)

### Data Deletion

If a client requests deletion:
1. Delete from all tables where `tenant_id = 'xxx'`
2. Delete from Supabase Storage (CSV uploads)
3. Document the deletion date
4. Confirm to client in writing

---

## Backup Strategy

### What's Automatically Backed Up

| Component | Backup Method | Retention |
|-----------|---------------|-----------|
| Database | Supabase daily backups | 7 days (free tier) |
| Code | GitHub | Unlimited (git history) |
| Environment vars | Manual | Document changes |

### Manual Backup Checklist (Monthly)

```
[ ] Export Supabase database (pg_dump or dashboard export)
[ ] Document current environment variables
[ ] Verify GitHub has latest code
[ ] Test that you can restore from backup
```

### Disaster Recovery

If something breaks badly:

1. **Database corrupted**: Restore from Supabase backup
2. **Code broken**: `git revert` or checkout previous commit
3. **Railway down**: Wait or redeploy
4. **Vercel down**: Wait or redeploy
5. **Supabase down**: Wait (no self-recovery option)

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P0 | App completely down | Immediately |
| P1 | Major feature broken | Within hours |
| P2 | Minor bug, workaround exists | Within days |
| P3 | Cosmetic issue | When convenient |

### Incident Playbook

**App Down (P0):**
```
1. Check Railway dashboard - is backend running?
2. Check Vercel dashboard - is frontend deployed?
3. Check Supabase dashboard - is database up?
4. Check Railway logs for errors
5. If recent deploy caused it: rollback
6. If unclear: check each component's health endpoint
```

**Data Not Syncing:**
```
1. Check Import History for failed jobs
2. Verify StoreHub credentials still valid
3. Check cron-job.org - is job running?
4. Manual trigger: POST /auto-fetch/trigger
5. Check Railway logs for errors
```

**Client Reports Wrong Data:**
```
1. Verify date range and filters
2. Compare with StoreHub directly
3. Check for duplicate imports
4. Verify RLS not blocking data
5. If data mismatch: investigate import logic
```

---

## Client Onboarding

### Checklist (see ONBOARDING_CHECKLIST.md for details)

```
[ ] Create tenant in Supabase
[ ] Create user account for client
[ ] Get StoreHub credentials (if auto-sync)
[ ] Import initial data
[ ] Verify dashboards working
[ ] Send CLIENT_WELCOME_GUIDE.md
[ ] Schedule walkthrough call
```

### Ongoing Client Support

- **Data questions**: Point to specific dashboard
- **Feature requests**: Add to BACKLOG.md, create GitHub issue
- **Bug reports**: Create GitHub issue with `bug` label
- **Access issues**: Check Supabase Auth logs

---

## Development Workflow

### Starting a Work Session

```bash
# 1. Pull latest code
cd ~/claude/restaurant-analytics
git pull

# 2. Start backend
cd backend
source venv/bin/activate
uvicorn main:app --reload

# 3. Start frontend (new terminal)
cd frontend
npm run dev

# 4. Open Claude Code
# Tell Claude: "Read CURRENT_CONTEXT.md and BACKLOG.md"
```

### Working on an Issue

```
1. Pick issue from GitHub or BACKLOG.md
2. Tell Claude: "Work on issue #X" or "Fix B1 from BACKLOG.md"
3. Test locally
4. Commit with message referencing issue: "Fix: Top items showing names #123"
5. Push to main (auto-deploys)
6. Verify in production
7. Close GitHub issue
```

### Commit Message Format

```
type: short description

- Detail 1
- Detail 2

Fixes #123
```

Types: `fix:`, `feat:`, `docs:`, `refactor:`, `style:`

### After Each Session

```
1. Commit and push all changes
2. Update CURRENT_CONTEXT.md if significant changes
3. Update BACKLOG.md (mark completed items)
4. Close any finished GitHub issues
```

---

## Quick Reference

### URLs

| Resource | URL |
|----------|-----|
| Production (Frontend) | https://musical-spotted-invention.vercel.app/ |
| Production (Backend) | https://musical-spotted-invention-production.up.railway.app/ |
| GitHub Repo | https://github.com/dannyboy637/musical-spotted-invention |
| GitHub Issues | https://github.com/dannyboy637/musical-spotted-invention/issues |
| Supabase Dashboard | https://supabase.com/dashboard |
| Railway Dashboard | https://railway.app/dashboard |
| Vercel Dashboard | https://vercel.com/dashboard |
| Cron Jobs | https://cron-job.org |

### Emergency Contacts

| Service | Support |
|---------|---------|
| Supabase | support@supabase.io |
| Railway | Discord or support@railway.app |
| Vercel | support@vercel.com |

---

*Keep this guide updated as your operations evolve.*
