# Session Log

> Append-only log of Claude Code sessions. Never delete entries.

---

## 2025-12-29 - Phase 0 Started

**Duration:** ~1 hour
**What was done:**
- Created backend scaffold (FastAPI with health endpoint)
- Created frontend scaffold (Vite + React + TypeScript)
- Installed core dependencies (TailwindCSS, React Query, Zustand, Axios)
- Configured path aliases and Tailwind
- Backend tested and working on localhost:8000

**What's next:**
- Test frontend build and dev server
- Verify frontend-backend connection
- Initial git commit

---

## 2025-12-30 - Phase 0 Completed

**Duration:** ~30 min
**Branch:** main

**What was done:**
- Fixed Tailwind CSS v4 configuration (added @tailwindcss/postcss, updated index.css to use @import)
- Tested frontend build: `npm run build` succeeds
- Tested frontend dev server: `npm run dev` works on localhost:5173
- Verified backend still running on localhost:8000
- Updated CURRENT_CONTEXT.md with completion status

**What's next:**
- Proceed to Phase 1: Authentication

**Blockers/Issues:**
- None

**Phase 0 Status:** COMPLETE

---

## 2025-12-30 - Phase 1: Authentication Complete

**Duration:** ~1 hour
**Branch:** feature/phase-1-auth

**What was done:**
- Set up Supabase project with email auth provider
- Created database migration: `users` table with roles enum, RLS policies, auto-create trigger
- Backend: Supabase client, JWT validation middleware (`get_current_user`), `/auth/me` endpoint
- Frontend: Supabase client, Zustand auth store with login/logout/resetPassword
- Created LoginPage and ForgotPasswordPage components
- Created ProtectedRoute (redirects to login) and PublicRoute (redirects to dashboard)
- Added Spinner component for loading states
- All acceptance criteria met and tested

**What's next:**
- Phase 2: Dashboard/Analytics features

**Blockers/Issues:**
- None

**Phase 1 Status:** COMPLETE

---

## 2025-12-30 - Phase 2: Tenant System Complete

**Duration:** ~2 hours
**Branch:** main

**What was done:**
- Created `tenants` table with RLS policies
- Updated role enum: `admin/manager/viewer` → `operator/owner/viewer`
  - **operator**: Platform super-admin, access all tenants
  - **owner**: Restaurant client, single tenant full access
  - **viewer**: Staff, single tenant read-only
- Added `tenant_id` FK to users table
- Created tenant CRUD routes (`backend/routes/tenant.py`)
- Added `require_operator` and `get_user_with_tenant` middleware
- Updated `/auth/me` to return tenant info
- Created frontend tenant store (`tenantStore.ts`)
- Created TenantSwitcher component for operators
- Updated documentation (PHASE_2_TENANT.md, CURRENT_CONTEXT.md)
- **Fixed JWT auth**: Migrated from HS256 to ES256 (JWKS-based verification)
  - Supabase now uses asymmetric keys (ES256)
  - Backend fetches public keys from JWKS endpoint
  - Added `certifi` for SSL certificate handling on macOS

**Migration required:**
Run `backend/migrations/002_create_tenants_table.sql` in Supabase SQL Editor

**What's next:**
- Phase 3: Dashboard/Analytics features

**Blockers/Issues:**
- Resolved: JWT algorithm mismatch (HS256 vs ES256)
- Resolved: SSL certificate issue on macOS

**Phase 2 Status:** COMPLETE

---

## 2025-12-30 - Phase 3: Data Pipeline Complete

**Duration:** ~3 hours
**Branch:** main

**What was done:**
- Created database migrations (003-006):
  - `transactions` table with RLS, indexes
  - `menu_items` aggregation table
  - `data_import_jobs` for audit/progress tracking
  - `aggregate_menu_items()` and `get_transaction_summary()` functions
- Ported legacy business logic to `backend/modules/data_processing.py`:
  - 17 excluded categories
  - Macro category mapping (35+ categories → 6)
  - Service charge proportional allocation
  - StoreHub CSV parsing (multi-row receipt structure)
- Created `backend/services/import_service.py` for import orchestration
- Created `backend/routes/data.py` with full CRUD endpoints
- Created `backend/scripts/import_storehub.py` CLI for manual imports
- Successfully imported 283,637 transactions (Jun 2024 - Nov 2025, ~18 months)
- Verified data integrity: ₱95.5M gross revenue, 769 menu items

**Bug fixes during import testing:**
1. **pandas not in venv**: Installed pandas in virtual environment
2. **NaN to integer conversion**: Added `safe_float()` and `safe_int()` helpers with NaN checks
3. **Timestamp serialization**: Convert pandas Timestamp to ISO string for JSON
4. **No progress output**: Added `flush=True` to print statements
5. **Slow imports**: Increased batch size from 100 to 500
6. **Service charge = 0**: Fixed `extract_service_charge_by_receipt()` to read from 'Service Charge' column (not SubTotal)
7. **gross_revenue = 0**: Fixed formula to `subtotal + tax + allocated_sc + discount` (discount is negative in StoreHub)

**What's next:**
- Phase 4: Dashboard UI

**Blockers/Issues:**
- Resolved: All import bugs fixed

**Phase 3 Status:** COMPLETE

---

## 2025-12-30 - Phase 3 Bugfix: store_name Column

**Duration:** ~15 min
**Branch:** main

**What was done:**
- Fixed missing `store_name` column (branch/location data)
- Created `007_add_store_name_column.sql` migration
- Updated `transform_storehub_row()` to extract Store column from CSV
- Updated `/data/branches` endpoint to query `store_name` directly
- Re-imported all CSVs with fix

**Verification:**
- Spotted Pig Cafe - Legazpi: 207,743 transactions
- Spotted Pig Cafe - Proscenium: 75,894 transactions
- Total: 283,637 (matches previous import)

**Blockers/Issues:**
- None

---

## 2025-12-30 - Phase 4: App Layout Complete

**Duration:** ~2 hours
**Branch:** main

**What was done:**
- Created app layout shell with sidebar, header, and global filters
- **Sidebar** (`Sidebar.tsx`):
  - Desktop: collapsible (256px ↔ 64px), persists state
  - Mobile: slide-out drawer with dark overlay
  - Gold highlight on active nav item
  - Settings link visible only for owner/operator
- **Header** (`Header.tsx`):
  - TenantSwitcher for operators
  - User dropdown with role badge and logout
- **GlobalFilters** (`GlobalFilters.tsx`):
  - Date range picker (react-day-picker + date-fns)
  - Branch multi-select (custom Tailwind component)
  - Category multi-select (custom Tailwind component)
  - URL sync: filters persist in query params, shareable
- **Stores**:
  - `uiStore.ts`: sidebar open/collapsed state
  - `filterStore.ts`: filter state + URL sync helpers
- **Routing**: Nested routes with `<Outlet>` in AppShell
- **Design System**: Navy + Gold colors via Tailwind v4 `@theme` in index.css
- **Dependencies added**: react-day-picker, date-fns, lucide-react

**Bug fixes:**
1. **Custom colors not working**: Tailwind v4 requires `@theme` in CSS, not JS config
2. **Date picker highlighting wrong dates**: Disabled `showOutsideDays`, added custom CSS
3. **Branch filter empty**: Discovered Phase 3 gap - `store_name` column missing from transactions table

**Files created:**
- `frontend/src/stores/uiStore.ts`
- `frontend/src/stores/filterStore.ts`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/GlobalFilters.tsx`
- `frontend/src/components/ui/MultiSelect.tsx`
- `frontend/src/components/ui/DateRangePicker.tsx`
- `frontend/src/modules/shared/PlaceholderPage.tsx`

**What's next:**
- Fix Phase 3 issue: Add `store_name` column, re-import data (separate session)
- Phase 5: Dashboard charts and KPIs

**Blockers/Issues:**
- Branch filter blocked until `store_name` column added (documented in PHASE_3_DATA.md)

**Phase 4 Status:** COMPLETE

---

## 2025-12-30 - Phase 4 Bugfix: Branches Filter

**Duration:** ~15 min
**Branch:** main

**What was done:**
- Fixed branches filter only showing Legazpi (not Proscenium)
- Root cause: Supabase `.select()` has default 1000 row limit, and with 207k Legazpi records first, we never saw Proscenium
- Solution: Created RPC functions for efficient `SELECT DISTINCT` queries
- Created migration `000_create_distinct_filters_functions.sql`
- Updated `/data/branches` and `/data/categories` endpoints to use RPC with fallback

**Files modified:**
- `backend/routes/data.py` - Use RPC for distinct values
- `backend/migrations/000_create_distinct_filters_functions.sql` (new)

**Verification:**
- Both branches now appear: "Spotted Pig Cafe - Legazpi" and "Spotted Pig Cafe - Proscenium"

**Phase 4 Status:** COMPLETE (all features working)

---

## 2025-12-30 - Phase 5: Analytics API Complete

**Duration:** ~1.5 hours
**Branch:** main

**What was done:**
- Created `backend/routes/analytics.py` with 8 analytics endpoints:
  - `GET /api/analytics/overview` - KPI summary (revenue, transactions, avg ticket, growth %)
  - `GET /api/analytics/menu-engineering` - Quadrant analysis (Star/Plowhorse/Puzzle/Dog)
  - `GET /api/analytics/dayparting` - Sales by 4 time periods (breakfast/lunch/dinner/late_night)
  - `GET /api/analytics/categories` - Category breakdown with revenue/quantity
  - `GET /api/analytics/bundles` - Frequent item pairs (market basket analysis)
  - `GET /api/analytics/performance` - Condensed trends + branch summary
  - `GET /api/analytics/performance/trends` - Detailed daily/weekly/monthly time series
  - `GET /api/analytics/performance/branches` - Detailed branch comparison
- All endpoints support filters: `start_date`, `end_date`, `branches`, `categories`
- Created `backend/migrations/008_add_menu_item_costs.sql` for future cost tracking
  - Added: `cost_cents`, `cost_percentage`, `target_margin` columns
- Registered analytics router in `main.py`
- Updated `CURRENT_CONTEXT.md` and `PHASE_5_API.md` spec

**Legacy logic ported:**
- Dayparting: 4 time buckets for Philippines timezone (UTC+8)
- Market basket: Frequent pairs algorithm with support percentage
- Performance trends: Daily/weekly/monthly aggregation with growth metrics

**Testing notes:**
- All endpoints verified in Swagger UI
- Issue encountered: Operator user had different `tenant_id` than transactions data
- Resolution: Assigned correct `tenant_id` to user record

**What's next:**
- Phase 6: Dashboard frontend charts (consume these APIs)

**Blockers/Issues:**
- None

**Phase 5 Status:** COMPLETE

---

## 2025-12-31 - Phase 6: Chart Components Complete

**Duration:** ~1 hour
**Branch:** main

**What was done:**
- Installed Recharts library for data visualization
- Created `frontend/src/lib/chartConfig.ts`:
  - 6-color chart palette (Navy, Gold, Emerald, Blue, Violet, Pink)
  - Quadrant colors for menu engineering
  - Currency/number formatters (₱ symbol, K/M abbreviations)
  - Standard chart styling (grid, axis, tooltip)
- Created 7 chart components in `frontend/src/components/charts/`:
  - `ChartContainer.tsx` - Wrapper with title, loading skeleton, empty states
  - `ChartSkeleton.tsx` - 5 animated skeleton variants (line, bar, donut, heatmap, scatter)
  - `LineChart.tsx` - Time series trends with multi-line support
  - `BarChart.tsx` - Vertical and horizontal layouts
  - `DonutChart.tsx` - Part-of-whole with legend
  - `Heatmap.tsx` - Custom 7×24 grid (day × hour) with color intensity
  - `MenuEngineeringScatter.tsx` - Quadrant scatter plot with divider lines
- Added backend endpoint `GET /api/analytics/hourly-heatmap`:
  - Returns sales data aggregated by day of week (0-6) and hour (0-23)
  - Supports same filters as other analytics endpoints
- Created temporary demo page at `/charts-demo` for visual testing

**Files created:**
- `frontend/src/lib/chartConfig.ts`
- `frontend/src/components/charts/*.tsx` (7 components + index)
- `frontend/src/modules/demo/ChartsDemoPage.tsx` (test page)

**Testing:**
- All chart types render correctly
- Loading skeletons animate properly
- Empty states display message
- Tooltips work on hover
- Responsive sizing works

**What's next:**
- Phase 7: Dashboard Assembly (wire charts to API data)
- Delete demo page after testing complete

**Blockers/Issues:**
- None

**Phase 6 Status:** COMPLETE

---

## 2025-01-05 - Phase 7: Dashboard Modules Complete + Optimizations

**Duration:** ~4 hours
**Branch:** main

**What was done:**

### Time Intelligence Enhancements
- Added Day-of-Week analysis for comparing same-day performance:
  - New endpoint: `GET /api/analytics/day-of-week`
  - `WeeklyRhythm` component: Average revenue by day of week
  - `SameDayTrend` component: Compare all Mondays to each other, etc.
  - User can filter by specific day (0-6)
- Added Year-over-Year comparison:
  - New endpoint: `GET /api/analytics/year-over-year`
  - `YearOverYearChart` component: Compare same month across years
  - Default to previous month for meaningful comparison

### Recommendations Tab Optimization
- **Problem**: Bundles showing 0 results, extremely slow loading (50+ API calls)
- **Solution**: Database-level aggregation via RPC
  - Created `011_create_bundles_rpc.sql` migration
  - Replaced Python pagination with single SQL self-join query
  - Loading time: 5-10s → <500ms
- Added period selector (Month/Quarter/6Mo/Year) replacing flexible date filters
  - Created `RecommendationsFilters.tsx` component
  - Recommendations page now uses local filters, bypasses global filters
  - Hidden global filter bar on `/recommendations` route
- Fixed bundle threshold settings:
  - Lowered API `min_frequency` from 5 to 3
  - Lowered frontend defaults from 10/3% to 3/0.5%
  - Added localStorage version migration for existing users

### Performance Trends Enhancement
- Added 7-day moving average to daily revenue trends
- Added 4-week moving average to weekly trends
- Enabled chart legend to show both raw and smoothed data

### Documentation Updates
- Updated `PHASE_5_API.md` with new endpoints and migrations
- Updated `PHASE_7_MODULES.md` - marked all sub-phases complete
- Updated `CURRENT_CONTEXT.md` - reflects Phase 7 complete, Phase 8 next
- Updated `SESSION_LOG.md` with today's work

**Files created/modified:**
- `backend/migrations/011_create_bundles_rpc.sql` (new)
- `backend/routes/analytics.py` (day-of-week, YoY, bundles RPC)
- `frontend/src/modules/time-intelligence/*.tsx` (WeeklyRhythm, SameDayTrend, YearOverYearChart)
- `frontend/src/modules/recommendations/RecommendationsFilters.tsx` (new)
- `frontend/src/modules/recommendations/RecommendationsPage.tsx` (period selector)
- `frontend/src/modules/recommendations/ruleEngine.ts` (localStorage migration)
- `frontend/src/modules/performance/TrendCharts.tsx` (moving average)
- `frontend/src/hooks/useAnalytics.ts` (recommendation-specific hooks)
- `frontend/src/components/layout/AppShell.tsx` (hide filters on /recommendations)

**What's next:**
- Phase 8: Alerts & Notifications

**Blockers/Issues:**
- None

**Phase 7 Status:** COMPLETE

---

## 2026-01-05 - Phase 8: Alerts & Anomaly Detection Complete

**Duration:** ~2 hours
**Branch:** main

**What was done:**

### Database
- Created `012_create_alerts_system.sql` migration:
  - `alert_settings` table: per-tenant configurable thresholds
  - `alerts` table: alert records with fingerprint for deduplication
  - RLS policies for tenant isolation, owner-only dismiss
  - `get_or_create_alert_settings()` RPC function

### Backend
- Created `backend/modules/anomaly.py` - Anomaly detection engine:
  - Revenue drop detection (week-over-week comparison)
  - Item spike/crash detection (week-over-week per item)
  - Quadrant change detection (month-over-month Star/Dog moves)
  - 7-day cooldown via fingerprint to prevent duplicate alerts
  - Uses latest transaction date (not today) for historical data support
- Created `backend/routes/alerts.py` - REST API:
  - `GET /api/alerts` - List alerts with filters (type, severity, active_only)
  - `POST /api/alerts/{id}/dismiss` - Owner-only dismiss
  - `POST /api/alerts/scan` - Manual trigger
  - `GET/PUT /api/alerts/settings` - Per-tenant thresholds
- Updated `import_service.py` - Auto-runs anomaly scan after data import

### Frontend
- Created `useAlerts.ts` hook - React Query hooks for alerts API
- Created `AlertBanner.tsx` - Dashboard banner showing top alert + count
- Created `AlertsPage.tsx` - Full alerts list with:
  - Type and severity filters
  - Show/hide dismissed toggle
  - Manual scan trigger button
  - Dismiss functionality (owner only)
- Added alert settings to `SettingsModal.tsx`:
  - Revenue drop threshold slider (5-50%)
  - Item spike threshold slider (25-100%)
  - Item crash threshold slider (25-100%)
  - Quadrant alerts toggle
- Added Alerts link to sidebar navigation
- Added `/alerts` route to App.tsx

### QOL Enhancement
- Added current date/time display in header (right side)
  - Format: "Jan 5, 2026 · 10:30 AM"
  - Updates every minute
  - Hidden on mobile to save space

### Bug Fixes
- Fixed anomaly detection using "today" instead of latest transaction date
- Fixed `gross_amount` → `gross_revenue` column name in quadrant detection

**Testing:**
- Ran scan successfully: 15 alerts created (6 new Dogs, 3 new Stars, etc.)
- Alert banner displays on dashboard
- Dismiss functionality works
- Settings sliders update thresholds

**Files created:**
- `backend/migrations/012_create_alerts_system.sql`
- `backend/modules/anomaly.py`
- `backend/routes/alerts.py`
- `frontend/src/hooks/useAlerts.ts`
- `frontend/src/components/alerts/AlertBanner.tsx`
- `frontend/src/modules/alerts/AlertsPage.tsx`
- `frontend/src/modules/alerts/index.ts`

**Files modified:**
- `backend/main.py` - Added alerts router
- `backend/services/import_service.py` - Auto-scan after import
- `frontend/src/App.tsx` - Added /alerts route
- `frontend/src/components/layout/Header.tsx` - Added date/time display
- `frontend/src/components/layout/Sidebar.tsx` - Added Alerts nav item
- `frontend/src/components/layout/SettingsModal.tsx` - Added alert settings
- `frontend/src/modules/dashboard/DashboardPage.tsx` - Added AlertBanner

**What's next:**
- Phase 9 or additional features as needed

**Blockers/Issues:**
- None

**Phase 8 Status:** COMPLETE

---

## 2026-01-05 - Phase 9: Scheduled Reports Complete

**Duration:** ~3 hours
**Branch:** main

**What was done:**

### Core Reports Feature (Previous Session)
- Created database migrations (013-014):
  - `reports` table with status workflow (pending/approved/sent)
  - `report_recipient_email` column on tenants
- Backend: Report generation module (`modules/reports.py`)
- Backend: AI narrative service (`services/ai_narrative.py`) with mock mode
- Backend: Email service (`services/email.py`) with mock mode
- Backend: Reports API (`routes/reports.py`) - full CRUD + actions
- Frontend: Report Center (`/reports`) - operator only
- Frontend: Report Preview (`/reports/:id`) - full workflow
- CLI: `scripts/generate_weekly_reports.py` for cron scheduling

### Flexible Time Periods (This Session)
- Added `period_type` column to reports table (migration 015)
- Period calculation helpers: `get_period_bounds()`, `get_month_bounds()`, `get_quarter_bounds()`, `get_year_bounds()`
- Period dropdown in generate modal: Last Week, Last Month, Last Quarter, Last Year
- Period type badges: Weekly/Monthly/Quarterly/Annual (color-coded)
- Alerts section hidden for non-weekly reports
- Email subject reflects period type (Weekly Report, Monthly Report, etc.)

### UX Improvements
- Movers display: "New/Trending" for >500% gains (new menu items)
- Movers display: "Discontinued" for -100% (removed items)
- Discussed filtering extreme outliers - decided to leave as-is since weekly (primary use case) won't have these issues

### Bug Fixes
- Fixed `gross_amount` → `gross_revenue` column name in `_get_movers()`
- Fixed `get_week_bounds` → `get_period_bounds('week')` in generate-all endpoint

**Files created:**
- `backend/migrations/015_add_report_period_type.sql`

**Files modified:**
- `backend/modules/reports.py` - Period helpers, skip alerts for non-weekly
- `backend/routes/reports.py` - period_type support, email subject
- `frontend/src/hooks/useReports.ts` - PeriodType, helper functions
- `frontend/src/modules/reports/ReportsPage.tsx` - Period dropdown, badges
- `frontend/src/modules/reports/ReportPreviewPage.tsx` - Period badge, hide alerts

**What's next:**
- All phases complete! Platform ready for production use
- Future: Enable real AI (ANTHROPIC_API_KEY), email (RESEND_API_KEY)

**Blockers/Issues:**
- None

**Phase 9 Status:** COMPLETE

---

## 2026-01-06 - Data Import Robustness & Graceful Cancellation

**Duration:** ~2 hours
**Branch:** main

**What was done:**

### Cancel Import Feature
- Created migration `027_add_cancelled_status_and_cleanup.sql`:
  - Added `cancelled` status to `import_status` enum
  - `cancel_import_job(p_job_id, p_user_id)` RPC: Validates permissions, deletes transactions, updates status
  - `cleanup_stale_import_jobs(p_timeout_hours)` RPC: Marks stuck jobs as failed after timeout
- Backend: Added `POST /data/imports/{job_id}/cancel` endpoint
- Backend: Added `is_job_cancelled()` method to ImportService
- Backend: Check cancellation status every batch, stop if cancelled
- Frontend: Added Cancel button to ImportHistoryTable
- Frontend: Added `useCancelImportJob` hook
- CLI: Created `scripts/cleanup_stale_imports.py` for hourly cron

### Navigation Warning & Auto-Cancel
- Frontend: Intercept link clicks during upload (capture phase event listener)
- Frontend: Show confirm dialog when user tries to navigate away
- Frontend: Auto-cancel job before allowing navigation
- Note: Replaced `useBlocker` (requires data router) with click interceptor pattern

### Consecutive Failure Abort
- Backend: Track consecutive batch failures
- Backend: Abort import after 5 consecutive failures
- Backend: Mark job as "failed" with descriptive error message
- Prevents infinite loop when persistent errors occur

### Duplicate Handling Fix
- Root cause: `upsert` with `ignore_duplicates=True` only checks primary key, not custom unique constraints
- Fix: Added `on_conflict="tenant_id,receipt_number,item_name,source_row_number"` to all upsert calls
- Now properly skips duplicate rows matching the `transactions_unique_row` constraint

### Storage Made Optional
- Issue: Supabase storage client requires trailing slash on URL
- Issue: Large files hit 413 Payload Too Large error
- Solution: Made storage upload non-blocking - logs warning but continues with import
- Import processing happens from memory, storage is just for backup

### Automatic Stale Job Cleanup
- Added `lifespan` context manager to FastAPI app
- Cleanup runs automatically on server startup
- Cleanup runs before each new upload
- No cron setup required - fully automatic

### Bug Fixes
- Fixed `non_item_rows` referenced before assignment in abort block
- Fixed cancel RPC not returning data (user needed to run migration)
- Added better error logging to upload endpoint for debugging

**Files created:**
- `backend/migrations/027_add_cancelled_status_and_cleanup.sql`
- `backend/scripts/cleanup_stale_imports.py`

**Files modified:**
- `backend/main.py` - Added lifespan with automatic stale job cleanup on startup
- `backend/routes/data.py` - Cancel endpoint, error logging, non-blocking storage, pre-upload cleanup
- `backend/services/import_service.py` - Cancellation check, consecutive failures, on_conflict fix
- `backend/db/supabase.py` - Trailing slash for storage URL
- `frontend/src/hooks/useDataManagement.ts` - cancelled status, useCancelImportJob
- `frontend/src/modules/data-management/ImportHistoryTable.tsx` - Cancel button, Actions column
- `frontend/src/modules/data-management/CSVUploadForm.tsx` - Navigation interception, auto-cancel

**What's next:**
- All phases complete! Platform fully operational
- Consider: Production deployment, real AI/email integration

**Blockers/Issues:**
- None - all issues resolved

**Status:** COMPLETE

---

## Template

```markdown
## YYYY-MM-DD - [Phase X: Description]

**Duration:** X hours
**Branch:** feature/xxx

**What was done:**
- Item 1
- Item 2

**What's next:**
- Next item 1

**Blockers/Issues:**
- None / Description
```
