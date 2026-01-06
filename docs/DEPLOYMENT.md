# Deployment Guide

Instructions for deploying the Restaurant Analytics platform to production.

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│   Frontend      │──────│    Backend      │──────│   Supabase      │
│   (Vercel)      │      │   (Railway)     │      │  (PostgreSQL)   │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
     React/Vite           FastAPI/Python         Auth + Database
```

## Prerequisites

- Supabase project created
- Vercel account (frontend)
- Railway account (backend)
- Domain name (optional)

---

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and keys:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET` (Settings > API > JWT Settings)

### Run Migrations

Execute all migrations in `backend/migrations/` in order:

```sql
-- In Supabase SQL Editor, run each file:
-- 000_create_users_table.sql
-- 001_create_tenants_table.sql
-- 002_create_transactions_table.sql
-- ... through ...
-- 027_add_cancel_import.sql
```

### Configure Auth

1. **Email Settings**: Settings > Auth > Email Templates
2. **Site URL**: Settings > Auth > Site URL = your frontend URL
3. **Redirect URLs**: Add your frontend URL to allowed redirects

### Create Storage Bucket

1. Storage > Create bucket: `csv-uploads`
2. Set policy to allow authenticated uploads

---

## 2. Backend Deployment (Railway)

### Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Select the `backend` folder as root

### Environment Variables

Set these in Railway dashboard:

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret

# App
DEBUG=false
FRONTEND_URL=https://yourapp.vercel.app

# Optional: Email service
RESEND_API_KEY=re_xxx

# Optional: AI narratives
ANTHROPIC_API_KEY=sk-ant-xxx
```

### Procfile

Create `Procfile` in backend folder if not exists:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Deploy

Railway auto-deploys on push to main branch.

Test health endpoint:
```bash
curl https://your-app.railway.app/health
```

---

## 3. Frontend Deployment (Vercel)

### Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Import GitHub repository
3. Set root directory to `frontend`

### Environment Variables

Set in Vercel dashboard:

```env
VITE_API_URL=https://your-app.railway.app
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Build Settings

- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Deploy

Vercel auto-deploys on push to main branch.

---

## 4. Domain Configuration

### Custom Domain (Vercel)

1. Vercel > Project > Settings > Domains
2. Add your domain
3. Configure DNS records as instructed

### Update CORS

Update backend `FRONTEND_URL` environment variable to your custom domain.

### Update Supabase

1. Supabase > Settings > Auth > Site URL
2. Update to your custom domain

---

## 5. Production Checklist

### Security

- [ ] All environment variables set (no defaults)
- [ ] `DEBUG=false` in backend
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled (100 req/min)
- [ ] Supabase RLS policies active

### Performance

- [ ] Frontend build produces chunked assets
- [ ] GZip compression enabled on backend
- [ ] Supabase connection pooling configured

### Monitoring

- [ ] Health check endpoint accessible
- [ ] Error logging configured
- [ ] Slow query logging (>1s)

### Backup

- [ ] Supabase daily backups enabled
- [ ] Export migrations to version control

---

## 6. Cron Jobs

### Weekly Reports

Set up a cron job to run weekly report generation:

```bash
# Every Monday at 8am Manila time (0:00 UTC Sunday)
0 0 * * 0 curl -X POST -H "Authorization: Bearer $SERVICE_TOKEN" \
  https://your-app.railway.app/api/reports/generate-all
```

Or use Railway cron service or external service like cron-job.org.

### Stale Job Cleanup

Runs automatically on server startup. Manual cleanup:

```bash
python scripts/cleanup_stale_imports.py
```

---

## 7. Troubleshooting

### Backend won't start

1. Check Railway logs
2. Verify all environment variables are set
3. Check Supabase connectivity

### Authentication fails

1. Verify JWT secret matches between Supabase and backend
2. Check CORS configuration
3. Verify Site URL in Supabase Auth settings

### Data import fails

1. Check CSV format matches StoreHub export
2. Verify storage bucket permissions
3. Check import job status in database

### Performance issues

1. Check Supabase query performance in dashboard
2. Review slow query logs (>300ms warnings)
3. Consider adding database indexes

---

## 8. Updating

### Database Migrations

1. Add new migration file to `backend/migrations/`
2. Run in Supabase SQL Editor
3. Deploy backend with any code changes

### Frontend Updates

1. Push to main branch
2. Vercel auto-deploys

### Backend Updates

1. Push to main branch
2. Railway auto-deploys
3. Zero-downtime with rolling deploys

---

## Support

For deployment issues:
- Check Railway/Vercel logs
- Review Supabase dashboard
- Open GitHub issue with error details
