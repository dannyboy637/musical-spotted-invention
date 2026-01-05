# Current Context

> **Last updated:** 2025-01-05
> **Read this file at the start of every Claude Code session.**

---

## Active Phase: Phase 8 - Alerts & Notifications (COMPLETE)

**Branch:** `main`
**Spec:** `docs/specs/PHASE_8_ALERTS.md`
**Status:** Complete - Anomaly detection and alert system implemented

---

## Completed Phases

### Phase 8: Alerts & Anomaly Detection - COMPLETE
- Database: `alerts`, `alert_settings` tables with RLS
- Backend: Anomaly detection module (`modules/anomaly.py`)
  - Revenue drop detection (week-over-week comparison)
  - Item spike/crash detection (week-over-week comparison)
  - Quadrant change detection (month-over-month comparison)
  - 7-day cooldown to prevent duplicate alerts
- Backend: Alerts API (`routes/alerts.py`)
  - `GET /api/alerts` - List alerts with filters
  - `POST /api/alerts/{id}/dismiss` - Owner-only dismiss
  - `POST /api/alerts/scan` - Manual trigger
  - `GET/PUT /api/alerts/settings` - Per-tenant thresholds
- Auto-scan after data import
- Frontend: AlertBanner on dashboard (top alert + count)
- Frontend: AlertsPage (`/alerts`) with list, filters, scan button
- Frontend: Alert settings in Settings modal (owner/operator only)
- Per-tenant configurable thresholds (revenue %, item %, quadrant toggle)

### Phase 7: Dashboard Modules - COMPLETE
All dashboard pages implemented with full functionality:
- **Executive Dashboard**: KPIs, revenue trends, top/bottom items
- **Menu Engineering**: BCG scatter plot, quadrant filters, zoom/pan, item details
- **Time Intelligence**: Daypart analysis, hourly heatmap, day-of-week patterns, YoY comparison
- **Performance Analytics**: Trend charts (daily/weekly/monthly), moving averages, growth metrics
- **Branch Comparison**: Branch performance table, top items per branch
- **Categories**: Category performance, macro grouping, drill-down
- **Recommendations**: Rule-based suggestions, bundle opportunities, period selector (bypasses global filters)
- **Cost Management**: Cost input form, bulk import, cost percentage display

### Phase 6: Chart Components - COMPLETE
- Installed Recharts library
- Created reusable chart components:
  - `ChartContainer` - Wrapper with loading/empty states
  - `ChartSkeleton` - 5 skeleton variants
  - `LineChart` - Time series trends (with moving average support)
  - `BarChart` - Vertical/horizontal layouts
  - `DonutChart` - Part-of-whole with legend
  - `Heatmap` - Day × Hour grid (custom SVG)
  - `MenuEngineeringScatter` - Quadrant plot with zoom/pan
- Chart config: Navy + Gold colors, formatters

### Phase 5: Analytics API - COMPLETE
- Backend: `/api/analytics/*` routes for dashboard data
- Endpoints:
  - `GET /api/analytics/overview` - KPI summary cards
  - `GET /api/analytics/menu-engineering` - Quadrant analysis
  - `GET /api/analytics/dayparting` - Sales by time of day (4 periods)
  - `GET /api/analytics/hourly-heatmap` - Day × Hour heatmap data
  - `GET /api/analytics/categories` - Category breakdown
  - `GET /api/analytics/bundles` - Frequent item pairs (RPC-based)
  - `GET /api/analytics/performance` - Condensed overview
  - `GET /api/analytics/performance/trends` - Detailed time series
  - `GET /api/analytics/performance/branches` - Branch comparison
  - `GET /api/analytics/day-of-week` - Day-of-week analysis
  - `GET /api/analytics/year-over-year` - Year-over-year comparison
- All endpoints accept filters: `start_date`, `end_date`, `branches`, `categories`
- Tenant isolation via RLS
- Migrations: `008-011` (costs, RPC functions, quadrant fix, bundles RPC)

### Phase 4: App Layout - COMPLETE
- Layout: AppShell with Sidebar, Header, GlobalFilters
- Sidebar: Collapsible (desktop), drawer overlay (mobile), nav with gold active state
- Header: Tenant display/switcher, user dropdown with role badge
- Filters: Date range picker, branch multi-select, category multi-select
- Settings modal: Theme toggle, default date range preference
- URL sync: Filters persist in URL params, shareable links work

### Phase 3: Data Pipeline - COMPLETE
- Database: `transactions`, `menu_items`, `data_import_jobs` tables with RLS
- Backend: Data processing module (ports legacy business logic)
- Backend: Import service with background processing
- Backend: `/data/*` routes for upload, transactions, menu-items
- CLI: `scripts/import_storehub.py` for manual imports
- Storage: Supabase bucket `csv-uploads`

### Phase 2: Tenant System - COMPLETE
- Roles: `operator` / `owner` / `viewer`
- Database: `tenants` table, `users.tenant_id` FK, RLS for tenant isolation
- Backend: Tenant CRUD routes, `require_operator` middleware
- Frontend: Tenant store, TenantSwitcher component (operator only)

### Phase 1: Authentication - COMPLETE
- Supabase project configured
- Database: `users` table with RLS policies, auto-create trigger
- Backend: JWT validation middleware, `/auth/me` endpoint
- Frontend: Zustand auth store, LoginPage, ForgotPasswordPage, ProtectedRoute

### Phase 0: Scaffold - COMPLETE
- Backend: FastAPI with health endpoint, CORS configured
- Frontend: Vite + React + TypeScript + Tailwind CSS v4
- Dependencies: @tanstack/react-query, zustand, axios

---

## Roles

| Role | Description | Access |
|------|-------------|--------|
| `operator` | Platform super-admin (you) | All tenants, full system |
| `owner` | Restaurant client | Single tenant, full dashboard |
| `viewer` | Staff accounts | Single tenant, read-only |

---

## Environment

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- Supabase: Project configured (credentials in `.env` files)

---

## Quick Start Commands

```bash
# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload

# Frontend
cd frontend
npm run dev
```

---

## Project Structure

```
backend/
├── main.py                      # FastAPI app entry
├── db/supabase.py               # Supabase client
├── middleware/auth.py           # JWT validation, tenant context
├── modules/
│   ├── data_processing.py       # Legacy business logic (categories, service charge)
│   └── anomaly.py               # Anomaly detection (revenue, items, quadrants)
├── services/
│   └── import_service.py        # CSV import orchestration
├── routes/
│   ├── auth.py                  # Auth endpoints
│   ├── tenant.py                # Tenant CRUD (operator only)
│   ├── data.py                  # Data import/transactions/menu-items
│   ├── analytics.py             # Dashboard analytics endpoints
│   └── alerts.py                # Alerts CRUD, scan trigger, settings
├── scripts/
│   └── import_storehub.py       # CLI import tool
└── migrations/                  # SQL migrations (000-012)

frontend/src/
├── lib/
│   ├── supabase.ts              # Supabase client
│   ├── queryClient.ts           # React Query client
│   └── chartConfig.ts           # Chart colors, formatters
├── stores/
│   ├── authStore.ts             # Auth state (Zustand)
│   ├── tenantStore.ts           # Tenant state
│   ├── filterStore.ts           # Global filters
│   ├── settingsStore.ts         # User preferences
│   └── uiStore.ts               # UI state (sidebar)
├── hooks/
│   ├── useAnalytics.ts          # React Query hooks for analytics API
│   └── useAlerts.ts             # React Query hooks for alerts API
├── modules/
│   ├── auth/                    # Login, ForgotPassword pages
│   ├── dashboard/               # Executive dashboard
│   ├── menu-engineering/        # BCG matrix, quadrant analysis
│   ├── time-intelligence/       # Daypart, heatmap, day-of-week, YoY
│   ├── performance/             # Trends, growth metrics
│   ├── branches/                # Branch comparison
│   ├── categories/              # Category deep dive
│   ├── recommendations/         # Rule-based suggestions, bundles
│   ├── costs/                   # Cost input, margin calculations
│   ├── data-management/         # Import, transactions view
│   └── alerts/                  # Alerts list page
├── components/
│   ├── layout/                  # AppShell, Sidebar, Header, GlobalFilters
│   ├── ui/                      # Spinner, DateRangePicker, MultiSelect, etc.
│   ├── charts/                  # Chart components (LineChart, BarChart, etc.)
│   └── alerts/                  # AlertBanner component
```

---

## Recent Changes (Jan 2025)

### Time Intelligence Enhancements
- Added Day-of-Week analysis (`/api/analytics/day-of-week`)
- Added Year-over-Year comparison (`/api/analytics/year-over-year`)
- New components: `WeeklyRhythm`, `SameDayTrend`, `YearOverYearChart`

### Recommendations Optimization
- Created `get_analytics_bundles` RPC function for fast bundle analysis
- Replaced 50+ paginated API calls with single RPC call
- Added period selector (Month/Quarter/6Mo/Year) - bypasses global filters
- Hidden global filters on Recommendations page
- Added localStorage version migration for bundle thresholds

### Performance Trends
- Added 7-day moving average to daily revenue trends
- Added 4-week moving average to weekly trends
- Enabled chart legend for moving average visibility

---

## Session Instructions

**At end of session, always:**
1. Update this file with current state
2. Append summary to `SESSION_LOG.md`
3. Commit work to appropriate branch

**Command to remind Claude Code:**
```
End of session. Update CURRENT_CONTEXT.md and append to SESSION_LOG.md
```
