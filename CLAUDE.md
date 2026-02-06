# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant restaurant analytics SaaS platform. Consulting-first model where the operator (Dan) receives CSV exports from restaurant clients (StoreHub POS), uploads/cleans data, and clients access polished analytics dashboards.

## Git Workflow - IMPORTANT

**NEVER merge branches to main without explicit approval from Dan.** The workflow is:

1. Create a feature/fix branch
2. Implement the changes
3. Run build/lint to verify no breaks
4. **STOP - Leave branch unmerged**
5. Wait for Dan to test and approve
6. Only merge after explicit "merge it" or similar approval

This applies to ALL changes - bugs, features, everything. Breaking main breaks the production app.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend:** FastAPI + Python
- **Database:** Supabase (PostgreSQL with RLS + Auth + Storage)
- **State:** Zustand (auth, UI, filters) + React Query (server data)
- **Charts:** Recharts

## Development Commands

```bash
# Backend (from project root)
cd backend
source venv/bin/activate
uvicorn main:app --reload
# Runs on http://localhost:8000

# Frontend (from project root)
cd frontend
npm run dev
# Runs on http://localhost:5173

# Frontend build/lint
cd frontend
npm run build    # TypeScript check + Vite build
npm run lint     # ESLint
```

## Environment Setup

Backend `.env`:
```
DEBUG=true
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Architecture

### Multi-Tenant Design
- All tenants share the same codebase
- Data isolation via Row-Level Security (RLS) policies filtering by `tenant_id`
- Auth context middleware extracts tenant context on every request

### User Roles
| Role | Access |
|------|--------|
| `operator` | All tenants, Control Hub, system admin |
| `owner` | Single tenant, full dashboard |
| `viewer` | Single tenant, read-only |

### Backend Structure
```
backend/
├── main.py                  # FastAPI app entry, CORS config
├── db/supabase.py           # Supabase client singleton
├── middleware/auth.py       # JWT validation utilities
├── middleware/auth_context.py  # Request.state user/tenant enrichment
├── modules/
│   ├── data_processing.py   # Legacy business logic (categories, service charge allocation)
│   └── anomaly.py           # Anomaly detection algorithms
├── routes/
│   ├── auth.py              # /auth/* endpoints
│   ├── tenant.py            # /tenants/* (operator only)
│   ├── data.py              # /data/* CSV upload, transactions, menu-items
│   ├── analytics.py         # /api/analytics/* dashboard data (11 endpoints)
│   └── alerts.py            # /api/alerts/* alert management
├── migrations/              # SQL migrations (000-047), run manually in Supabase
└── scripts/import_storehub.py  # CLI data import tool
```

### Frontend Structure
```
frontend/src/
├── stores/                  # Zustand stores
│   ├── authStore.ts         # Auth state, user session
│   ├── tenantStore.ts       # Active tenant, tenant list
│   ├── filterStore.ts       # Global date/branch/category filters
│   └── settingsStore.ts     # User preferences, theme
├── hooks/
│   ├── useAnalytics.ts      # React Query hooks for all analytics endpoints
│   └── useAlerts.ts         # React Query hooks for alerts
├── modules/                 # Feature modules (pages + components)
│   ├── auth/                # LoginPage, ForgotPasswordPage
│   ├── dashboard/           # Executive summary KPIs
│   ├── menu-engineering/    # BCG matrix scatter plot
│   ├── time-intelligence/   # Daypart, heatmap, day-of-week, YoY
│   ├── performance/         # Trend charts with moving averages
│   ├── branches/            # Branch comparison
│   ├── categories/          # Category breakdown
│   ├── recommendations/     # Rule-based suggestions, bundle analysis
│   ├── costs/               # Cost input, margin calculations
│   ├── data-management/     # Import UI, transaction viewer
│   └── alerts/              # Alert list and settings
├── components/
│   ├── layout/              # AppShell, Sidebar, Header, GlobalFilters
│   ├── charts/              # LineChart, BarChart, DonutChart, Heatmap, MenuEngineeringScatter
│   └── ui/                  # Spinner, DateRangePicker, MultiSelect, etc.
└── lib/
    ├── supabase.ts          # Supabase client
    ├── queryClient.ts       # React Query config
    └── chartConfig.ts       # Chart colors/formatters
```

## Design System

- **Colors:** Navy (#102a43 to #f0f4f8) + Gold (#b45309 to #fffbeb)
- **Charts:** 6-color palette starting with navy-700 and gold-500
- **Icons:** Lucide React
- **Custom colors in Tailwind:** `navy-*` and `gold-*` scales available

## Database

- Migrations in `backend/migrations/` - run manually in Supabase SQL editor
- Key tables: `users`, `tenants`, `transactions`, `menu_items`, `alerts`, `alert_settings`
- RLS policies enforce tenant isolation
- RPC functions in `009_create_analytics_rpc_functions.sql` and `011_create_bundles_rpc.sql`

## Key Patterns

1. **Analytics endpoints** accept query params: `start_date`, `end_date`, `branches`, `categories`
2. **Filter state** syncs to URL for shareable links (see `filterStore.ts`)
3. **Chart components** wrap Recharts with consistent styling and loading states
4. **Anomaly detection** runs automatically after data import (configurable per-tenant)

## Documentation

- `docs/CURRENT_CONTEXT.md` - Current state, completed phases
- `docs/MASTERFILE.md` - Project overview, quick links
- `docs/specs/` - Phase specifications (PHASE_0 through PHASE_12)
- `docs/LEGACY_CODE.md` - Business logic ported from original MVP
