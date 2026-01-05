# Phase 5: Analytics API

> **Goal:** All dashboard data endpoints working.
> **Branch:** `main`
> **Reference:** `docs/LEGACY_CODE.md` for calculation logic
> **Status:** COMPLETE

---

## Deliverables

### Routes
- [x] `backend/routes/analytics.py` - All analytics endpoints in single router

### Modules
- [x] Dayparting logic integrated into `analytics.py` (4 periods: breakfast, lunch, dinner, late_night)
- [x] Market basket analysis integrated into `analytics.py` (frequent pairs algorithm)
- [x] Performance/trends logic integrated into `analytics.py`
- [x] Menu engineering uses existing `menu_items` table with pre-calculated quadrants

### Database
- [x] `backend/migrations/008_add_menu_item_costs.sql` - Cost fields for future owner input
- [x] `backend/migrations/009_create_analytics_rpc_functions.sql` - RPC functions for performance analytics
- [x] `backend/migrations/010_fix_quadrant_calculation.sql` - Fixed quadrant assignment logic
- [x] `backend/migrations/011_create_bundles_rpc.sql` - RPC function for fast bundle analysis

---

## Endpoints

```
GET /api/analytics/overview              - KPI summary cards
GET /api/analytics/menu-engineering      - Quadrant analysis
GET /api/analytics/dayparting            - Sales by time of day (4 periods)
GET /api/analytics/hourly-heatmap        - Day × Hour heatmap data
GET /api/analytics/categories            - Category breakdown
GET /api/analytics/bundles               - Frequent item pairs (uses RPC)
GET /api/analytics/performance           - Condensed overview
GET /api/analytics/performance/trends    - Detailed time series
GET /api/analytics/performance/branches  - Branch comparison
GET /api/analytics/day-of-week           - Day-of-week analysis (same-day comparison)
GET /api/analytics/year-over-year        - Year-over-year comparison by month
```

All endpoints accept:
- `start_date`, `end_date` (query params)
- `branches` (comma-separated)
- `categories` (comma-separated)

Additional parameters:
- `/bundles`: `min_frequency` (default 3), `limit` (default 20)
- `/day-of-week`: `day_filter` (0-6, optional)
- `/year-over-year`: `month` (1-12, required)

---

## Menu Engineering Logic

Ported from `docs/LEGACY_CODE.md`:
- [x] Core menu classification (6+ months active, sold in last 30 days)
- [x] Quadrant assignment (Star, Plowhorse, Puzzle, Dog) via `aggregate_menu_items()` SQL function
- [x] Price as profit proxy (default)
- [x] Cost fields added for future owner input (cost_cents, cost_percentage, target_margin)

---

## Acceptance Criteria

- [x] All endpoints return correct data
- [x] Filters work (date, branch, category)
- [x] Tenant isolation enforced via RLS
- [x] Response times < 500ms for typical queries

---

*Phase 5 COMPLETE - 2025-12-30*
