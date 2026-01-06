# Current Context

> **Last updated:** 2026-01-06
> **Read this file at the start of every Claude Code session.**

---

## Active Phase: Phase 11 Complete

**Branch:** `main`
**Status:** Phase 11 (Polish & Hardening) complete - Production-ready quality

---

## Completed Phases

### Phase 11: Polish & Hardening - COMPLETE
- **Error Handling:**
  - ErrorBoundary component with role-based error display (operators see technical details)
  - 404 NotFoundPage with simple message and home link
  - Toast notification system (react-hot-toast) for API errors
  - Global error handler in React Query with 401 redirect to login
  - Global exception handler in FastAPI for consistent error responses
- **Loading States:**
  - TableSkeleton, ListSkeleton, PageSkeleton components
  - Lazy loading all routes with Suspense fallback
  - ChartSkeleton (5 variants: line, bar, donut, heatmap, scatter)
- **Empty States:**
  - EmptyState component with icon, title, description, CTA
  - Enhanced ChartContainer with emptyDescription, emptyActionLabel, emptyActionHref
  - Context-aware empty messages on dashboard charts
- **Mobile Optimization:**
  - Collapsible GlobalFilters on mobile with active filter count badge
  - Responsive chart margins helper function
  - DataTable already has horizontal scroll
  - Sidebar hamburger menu already implemented
- **Performance:**
  - Lazy loading all 15 page routes
  - Vite code splitting with manual vendor chunks
  - Bundle split: React (48KB), Charts (396KB), Supabase (169KB), etc.
  - Initial load significantly reduced
- **Security:**
  - Rate limiting: 100 req/min per user (slowapi)
  - GZip compression for responses > 1KB
  - Consistent error response format with error codes
  - 429 response with Retry-After header
- **Documentation:**
  - README.md updated for potential clients/demo with feature highlights
  - docs/API.md - Complete API reference with curl examples
  - docs/DEPLOYMENT.md - Production deployment guide
  - docs/screenshots/ directory (screenshots to be added manually)

### Phase 9: Scheduled Reports - COMPLETE
- Database: `reports` table with status workflow (pending/approved/sent)
- Database: `report_recipient_email` column added to tenants
- Database: `period_type` column for flexible time periods (migration 015)
- Backend: Report generation module (`modules/reports.py`)
  - KPIs aggregation (revenue, transactions, avg check, % changes)
  - Top items by revenue
  - Gainers/decliners (period-over-period comparison)
  - Active alerts inclusion (weekly reports only)
  - Flexible period calculation (week/month/quarter/year)
- Backend: AI narrative service (`services/ai_narrative.py`)
  - Mock mode for development (toggle MOCK_MODE)
  - Two styles: full summary (2-3 paragraphs) or bullet points
  - Claude API integration ready (add ANTHROPIC_API_KEY)
- Backend: Email service (`services/email.py`)
  - Resend integration (placeholder - add RESEND_API_KEY)
  - HTML email template with KPIs, narrative, top items
  - Mock mode for development
- Backend: Reports API (`routes/reports.py`)
  - `POST /api/reports/generate` - Generate single report (with period_type)
  - `POST /api/reports/generate-all` - Generate for all tenants
  - `GET /api/reports` - List with status filter
  - `GET /api/reports/{id}` - Get single report
  - `PUT /api/reports/{id}` - Update narrative
  - `POST /api/reports/{id}/regenerate` - Regenerate AI narrative
  - `POST /api/reports/{id}/approve` - Mark as approved
  - `POST /api/reports/{id}/send` - Send email (subject reflects period type)
  - `DELETE /api/reports/{id}` - Delete pending/approved reports
- Frontend: Report Center (`/reports`) - Operator only
  - Reports list with status and period type badges
  - Generate single report with period dropdown (Week/Month/Quarter/Year)
  - Generate all (weekly only)
  - Status summary cards
  - Delete pending reports
- Frontend: Report Preview (`/reports/:id`)
  - Full report preview with KPIs, narrative, top items
  - Period type badge (Weekly/Monthly/Quarterly/Annual)
  - Edit narrative text inline
  - Regenerate AI with style toggle
  - Approve workflow
  - Send with email override option
  - Alerts section hidden for non-weekly reports
  - Movers display: "New/Trending" for >500%, "Discontinued" for -100%
- CLI: `scripts/generate_weekly_reports.py` for cron scheduling
- Schedule: Monday 8am Manila time (previous Mon-Sun period)

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
│   ├── anomaly.py               # Anomaly detection (revenue, items, quadrants)
│   └── reports.py               # Report data generation
├── services/
│   ├── import_service.py        # CSV import orchestration
│   ├── ai_narrative.py          # Claude API for report narratives
│   └── email.py                 # Resend email service
├── routes/
│   ├── auth.py                  # Auth endpoints
│   ├── tenant.py                # Tenant CRUD (operator only)
│   ├── data.py                  # Data import/transactions/menu-items
│   ├── analytics.py             # Dashboard analytics endpoints
│   ├── alerts.py                # Alerts CRUD, scan trigger, settings
│   └── reports.py               # Reports CRUD, generate, send
├── scripts/
│   ├── import_storehub.py       # CLI import tool
│   └── generate_weekly_reports.py  # Cron script for weekly reports
└── migrations/                  # SQL migrations (000-015)

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
│   ├── useAlerts.ts             # React Query hooks for alerts API
│   └── useReports.ts            # React Query hooks for reports API
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
│   ├── alerts/                  # Alerts list page
│   └── reports/                 # Report Center, Report Preview (operator only)
├── components/
│   ├── layout/                  # AppShell, Sidebar, Header, GlobalFilters
│   ├── ui/                      # Spinner, DateRangePicker, MultiSelect, etc.
│   ├── charts/                  # Chart components (LineChart, BarChart, etc.)
│   └── alerts/                  # AlertBanner component
```

---

## Recent Changes (Jan 2026)

### Data Import Robustness (Jan 6, 2026) - COMPLETE
- **Cancel Import Feature**: Manual cancel button + auto-cancel when user navigates away
  - Migration 027: Added `cancelled` status, `cancel_import_job()` RPC
  - Backend checks job status every batch, stops if cancelled
  - Frontend intercepts navigation during upload, shows confirm dialog
- **Consecutive Failure Abort**: Import stops after 5 failed batches (prevents infinite loops)
- **Duplicate Handling Fix**: Added `on_conflict` parameter to upsert for proper unique constraint handling
- **Automatic Stale Job Cleanup**: No cron needed!
  - Runs on server startup (cleans up jobs from previous crashes)
  - Runs before each new upload (catches long-stale jobs)
  - Manual script still available: `scripts/cleanup_stale_imports.py`
- **Storage Made Optional**: Storage upload failures no longer block import processing

### Phase 9: Scheduled Reports (Complete)
- Full report generation with AI narrative (mock mode)
- Operator approval workflow: Generate → Edit → Approve → Send
- Flexible time periods: Last Week, Last Month, Last Quarter, Last Year
- Period type badges (Weekly/Monthly/Quarterly/Annual)
- Alerts excluded from historical (non-weekly) reports
- Movers display: "New/Trending" for extreme gains, "Discontinued" for -100%

### Phase 8: Alerts & Anomaly Detection
- Revenue drop detection, item spike/crash alerts, quadrant change alerts
- Per-tenant configurable thresholds
- AlertBanner on dashboard, full AlertsPage

### Earlier (Dec 2025)
- Time Intelligence: Day-of-Week analysis, Year-over-Year comparison
- Recommendations: Bundle RPC optimization, period selector
- Performance Trends: Moving averages (7-day, 4-week)

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
