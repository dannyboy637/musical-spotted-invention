# Phase 12.5: Pre-Aggregated Summary Tables

> **Status:** COMPLETE (Jan 7, 2026)
> **Priority:** Performance optimization for scale
> **Prerequisite:** Phase 12 validation complete

---

## Problem Statement

Current architecture computes aggregations on-demand from raw `transactions` table (600k+ rows). This causes:
- 1-5 second load times per dashboard
- Repeated computation for same queries
- Database CPU spikes during dashboard usage
- Poor scaling as data grows (O(n) per query)

## Inspiration: Original MVP Architecture

The Streamlit MVP used pre-computed parquet files per dashboard:
- `menu_engineering_items.parquet` → Menu Engineering
- `item_pairs.parquet` → Bundle/Recommendations
- `hourly_sales.parquet` → Heatmap/Dayparting
- `branch_monthly.parquet` → Branch Comparison
- `clean_menu_items.parquet` → Item aggregates

**Result:** Instant dashboard loads regardless of data size.

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RAW DATA LAYER                          │
│  transactions (600k+ rows per tenant)                       │
│  - Source of truth                                          │
│  - Only touched during imports                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ (refresh after each import)
┌─────────────────────────────────────────────────────────────┐
│                  AGGREGATION LAYER                          │
│  hourly_summaries    (~15k rows/tenant)  - NEW              │
│  menu_items          (~50 rows/tenant)   - EXISTS           │
│  item_pairs          (~100 rows/tenant)  - NEW              │
│  branch_summaries    (~60 rows/tenant)   - NEW              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ (instant queries <200ms)
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARD LAYER                          │
│  Simple SELECTs with filters, no heavy aggregation          │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary Tables Design

### 1. `hourly_summaries`

**Covers:** Overview, Dayparting, Heatmap, Trends, Performance

```sql
CREATE TABLE hourly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Time dimensions
  hour_bucket TIMESTAMPTZ NOT NULL,  -- Truncated to hour (UTC)
  sale_date DATE NOT NULL,           -- Local date (Manila)
  local_hour INT NOT NULL,           -- 0-23 (Manila timezone)
  day_of_week INT NOT NULL,          -- 0=Sun, 6=Sat

  -- Grouping dimensions
  store_name TEXT,                   -- NULL = all branches
  category TEXT,                     -- NULL = all categories
  macro_category TEXT,

  -- Metrics
  revenue BIGINT NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  transaction_count INT NOT NULL DEFAULT 0,
  receipt_count INT NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, hour_bucket, store_name, category)
);

-- Indexes for common query patterns
CREATE INDEX idx_hourly_tenant_date ON hourly_summaries(tenant_id, sale_date);
CREATE INDEX idx_hourly_tenant_hour ON hourly_summaries(tenant_id, local_hour);
CREATE INDEX idx_hourly_tenant_dow ON hourly_summaries(tenant_id, day_of_week);
CREATE INDEX idx_hourly_tenant_store ON hourly_summaries(tenant_id, store_name);
```

**Row count estimate:**
- 18 months × 30 days × 24 hours × 5 branches × 10 categories = ~650k rows max
- With sparse hours (restaurant open 12h/day): ~150k rows
- With category rollup (store NULL rows): ~15k rows

### 2. `item_pairs`

**Covers:** Bundle Analysis, Recommendations

```sql
CREATE TABLE item_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Pair identification
  item_a TEXT NOT NULL,
  item_b TEXT NOT NULL,  -- Always item_a < item_b alphabetically

  -- Metrics
  frequency INT NOT NULL,            -- Times bought together
  support NUMERIC(5,2),              -- % of receipts containing pair

  -- Time range analyzed
  analysis_start DATE NOT NULL,
  analysis_end DATE NOT NULL,

  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, item_a, item_b)
);

CREATE INDEX idx_pairs_tenant_freq ON item_pairs(tenant_id, frequency DESC);
```

**Row count estimate:** ~100-500 pairs per tenant (top pairs only)

### 3. `branch_summaries`

**Covers:** Branch Comparison, Performance by Branch

```sql
CREATE TABLE branch_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Dimensions
  period_type TEXT NOT NULL,         -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  store_name TEXT NOT NULL,

  -- Metrics
  revenue BIGINT NOT NULL DEFAULT 0,
  transaction_count INT NOT NULL DEFAULT 0,
  receipt_count INT NOT NULL DEFAULT 0,
  avg_ticket INT,

  -- Pre-computed JSON for fast reads
  top_items JSONB,                   -- [{item, quantity, revenue}, ...]
  category_breakdown JSONB,          -- {category: revenue, ...}

  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, period_type, period_start, store_name)
);

CREATE INDEX idx_branch_tenant_period ON branch_summaries(tenant_id, period_type, period_start);
```

**Row count estimate:**
- Monthly: 18 months × 5 branches = 90 rows
- Weekly: 78 weeks × 5 branches = 390 rows
- Daily: 540 days × 5 branches = 2,700 rows

### 4. `menu_items` (EXISTS - may need enhancements)

Already exists and working. May need:
- Add `period_start`/`period_end` columns for time-filtered views
- Add `store_name` for branch-specific menu analysis

---

## Refresh Strategy

### Option A: Full Refresh After Import

```python
# import_service.py
def refresh_all_summaries(self):
    """Refresh all summary tables after import."""
    supabase.rpc("refresh_hourly_summaries", {"p_tenant_id": self.tenant_id})
    supabase.rpc("refresh_item_pairs", {"p_tenant_id": self.tenant_id})
    supabase.rpc("refresh_branch_summaries", {"p_tenant_id": self.tenant_id})
    supabase.rpc("aggregate_menu_items", {"p_tenant_id": self.tenant_id})
```

**Pros:** Simple, always accurate
**Cons:** Slow for large datasets (could add 30-60s to import)

### Option B: Incremental Refresh

Only refresh affected time periods:

```sql
-- Refresh only new/modified dates
CREATE FUNCTION refresh_hourly_summaries_incremental(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
```

**Pros:** Fast refresh
**Cons:** More complex, risk of drift

### Option C: Background Refresh

Queue refresh as background job, don't block import:

```python
# After import completes
background_tasks.add_task(refresh_summaries, tenant_id)
```

**Pros:** Fast import, eventual consistency
**Cons:** Dashboard may show stale data briefly

**Recommendation:** Start with Option A, optimize to Option C if refresh is slow.

---

## RPC Function Changes

### Before (Current)
```sql
-- Scans 600k rows every time
SELECT SUM(gross_revenue), COUNT(*)
FROM transactions
WHERE tenant_id = $1 AND receipt_timestamp BETWEEN $2 AND $3
```

### After (With Summaries)
```sql
-- Scans ~500 rows
SELECT SUM(revenue), SUM(transaction_count)
FROM hourly_summaries
WHERE tenant_id = $1 AND sale_date BETWEEN $2 AND $3
```

**Migration path:**
1. Create summary tables
2. Create refresh functions
3. Modify existing RPC functions to query summaries
4. Keep raw transaction queries as fallback for edge cases

---

## Dashboard Mapping

| Dashboard | Current Data Source | New Data Source |
|-----------|---------------------|-----------------|
| Executive Overview | `get_analytics_overview()` → transactions | hourly_summaries |
| Dayparting | `get_analytics_dayparting()` → transactions | hourly_summaries (group by local_hour ranges) |
| Heatmap | `get_analytics_heatmap()` → transactions | hourly_summaries (group by day_of_week, local_hour) |
| Trends | `get_analytics_trends()` → transactions | hourly_summaries (group by sale_date/week/month) |
| Performance | `get_analytics_performance()` → transactions | hourly_summaries + branch_summaries |
| Branches | `get_analytics_branches()` → transactions | branch_summaries |
| Categories | `get_analytics_categories()` → transactions | hourly_summaries (group by category) |
| Menu Engineering | `menu_items` table | menu_items (no change) ✅ |
| Bundles | `get_analytics_bundles()` → transactions | item_pairs |
| Recommendations | `get_analytics_bundles()` → transactions | item_pairs |

---

## Performance Expectations

| Metric | Current (600k rows) | With Summaries |
|--------|---------------------|----------------|
| Overview load | 1-3s | <100ms |
| Dayparting load | 2-5s | <100ms |
| Heatmap load | 2-4s | <100ms |
| Trends load | 1-3s | <200ms |
| Branches load | 3-8s | <100ms |
| Bundles load | 5-15s | <100ms |
| Date filter change | 1-3s | <100ms |
| Import + refresh | 60s | 90s (+30s refresh) |

---

## Open Questions

1. **Granularity:** Should hourly_summaries include category dimension, or have separate category_summaries table?

2. **Historical bundles:** Should item_pairs store historical snapshots, or just latest 90 days?

3. **Filter flexibility:** How to handle arbitrary filter combinations (e.g., specific branch + specific category + date range)?

4. **Rollup rows:** Should we pre-compute rollup rows (e.g., store_name=NULL for all-branches totals)?

5. **Refresh timing:** Sync after import vs async background job?

6. **Migration:** How to populate summaries for existing tenants with data?

---

## Implementation Phases

### 12.5a: Design Finalization ✅ COMPLETE
- [x] Finalize table schemas
- [x] Decide on refresh strategy (Full refresh after import, Option A)
- [x] Document filter handling approach

### 12.5b: Database Layer ✅ COMPLETE
- [x] Create summary tables with RLS (Migrations 031-033)
  - `hourly_summaries` - hour/branch/category aggregates
  - `item_pairs` - frequent item pairs
  - `branch_summaries` - period-based branch metrics
- [x] Create refresh RPC functions (Migration 034)
  - `refresh_hourly_summaries()`
  - `refresh_item_pairs()`
  - `refresh_branch_summaries()`
  - `refresh_all_summaries()`
- [x] Create V2 analytics functions (Migration 035)
  - 8 v2 functions querying summary tables
- [x] Create indexes for common query patterns

### 12.5c: Backend Integration ✅ COMPLETE
- [x] Modify RPC functions to use summaries
- [x] Update all analytics endpoints to use v2 functions
- [x] Fix Pydantic model types (int → float for averages)
- [x] Add cache utilities (`invalidate_tenant()`, `invalidate_all()`)
- [x] Hook refresh into import pipeline (auto-calls `refresh_all_summaries()` after import)
- [x] Add manual refresh endpoint for operator (`POST /data/summaries/refresh`)

### 12.5d: Testing & Migration ✅ COMPLETE
- [x] Populate summaries for existing tenants (manual via SQL Editor)
- [x] Verify all dashboards working across all tenants
- [x] Verify filter accuracy
- [x] Performance verified: <200ms dashboard loads

### 12.5e: Complete ✅
- [x] **Automatic summary refresh after imports** - `ImportService.process_csv()` calls `refresh_all_summaries()` after successful imports
- [x] **Manual refresh endpoint** - `POST /data/summaries/refresh` for operators
- [ ] **Operator Control Hub optimization** - Deferred to future phase (not blocking)
- [ ] **Performance monitoring** - Deferred to future phase (not blocking)

### 12.5f: Git & Deployment

**Current State:** All changes made directly on `main` branch.

**To commit changes:**
```bash
cd /Users/Daniel/claude/restaurant-analytics
git add -A
git commit -m "feat: Complete Phase 12.5 - Pre-aggregated summary tables

Database:
- Migrations 031-037: Summary tables, refresh functions, v2 analytics, delete import
- hourly_summaries, item_pairs, branch_summaries tables with RLS
- V2 analytics functions querying summary tables instead of raw transactions

Backend:
- All analytics endpoints migrated to v2 functions
- Fixed Pydantic model types (int → float for averages)
- Added cache invalidation utilities
- Delete import feature with proper permissions

Frontend:
- Import History: Tenant column for operators, delete button
- Fixed operator role detection

Performance: Dashboard loads reduced from 1-5s to <200ms

🤖 Generated with Claude Code

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push origin main
```

**Database Migrations to Run:**
If deploying to a new environment, run these migrations in order in Supabase SQL Editor:
1. `031_create_hourly_summaries.sql`
2. `032_create_item_pairs.sql`
3. `033_create_branch_summaries.sql`
4. `034_create_refresh_functions.sql`
5. `035_create_analytics_v2_functions.sql`
6. `036_add_delete_import_feature.sql`
7. `037_fix_delete_import_permissions.sql`

**After migrations, populate summaries for each tenant:**
```sql
SELECT refresh_all_summaries('tenant-uuid-1');
SELECT refresh_all_summaries('tenant-uuid-2');
-- etc.
```

---

## Migrations Created

| Migration | Description |
|-----------|-------------|
| 031 | `hourly_summaries` table with RLS |
| 032 | `item_pairs` table with RLS |
| 033 | `branch_summaries` table with RLS |
| 034 | Refresh functions (`refresh_*_summaries`) |
| 035 | V2 analytics functions |
| 036 | Delete import feature (`delete_import_job` RPC) |
| 037 | Fix delete import permissions (GRANT EXECUTE) |

---

## Performance Results (Actual)

| Dashboard | Before | After |
|-----------|--------|-------|
| Overview | 1-3s | <100ms |
| Dayparting | 2-5s | <100ms |
| Heatmap | 2-4s | <100ms |
| Categories | 2-4s | <100ms |
| Trends | 1-3s | <200ms |
| Branches | 3-8s | <100ms |
| Bundles | 5-15s | <100ms |

---

## Notes

- This is the same pattern used by data warehouses (star schema with fact/dimension tables)
- Supabase materialized views could work but lack tenant-aware refresh
- The `menu_items` table is proof this pattern works - it's already fast
- V2 functions return floats for averages (not integers) - Pydantic models updated accordingly
- Heatmap v2 returns `{"data": [...]}` JSON object, not raw array
