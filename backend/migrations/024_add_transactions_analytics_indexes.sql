-- Migration 024: Add optimized indexes for analytics queries
-- These indexes dramatically speed up the analytics RPC functions that
-- aggregate data from the transactions table.

-- Primary composite index for analytics queries
-- Covers: tenant_id + date range + optional branch filter
-- This is the most important index for analytics performance
CREATE INDEX IF NOT EXISTS idx_transactions_analytics_primary
ON transactions(tenant_id, receipt_timestamp DESC);

-- Index for branch-filtered queries
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_branch_date
ON transactions(tenant_id, store_name, receipt_timestamp DESC);

-- Index for category-filtered queries
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_category_date
ON transactions(tenant_id, category, receipt_timestamp DESC);

-- Index for is_excluded filtering (used in categories endpoint)
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_excluded
ON transactions(tenant_id, is_excluded, receipt_timestamp DESC);

-- Covering index for common aggregation columns
-- This allows index-only scans for simple aggregations
CREATE INDEX IF NOT EXISTS idx_transactions_analytics_covering
ON transactions(tenant_id, receipt_timestamp)
INCLUDE (gross_revenue, quantity, receipt_number, item_name);

-- Index for unique item counts (used in overview)
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_item
ON transactions(tenant_id, item_name);

-- Index for hour-based aggregations (heatmap, dayparting)
-- PostgreSQL can use expressions in index, but we'll rely on the primary index
-- and let the query planner handle hour extraction

-- Partial index for non-excluded items (common case)
CREATE INDEX IF NOT EXISTS idx_transactions_not_excluded
ON transactions(tenant_id, receipt_timestamp DESC)
WHERE is_excluded = FALSE OR is_excluded IS NULL;

-- Index for menu_items queries (used in menu engineering)
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_category
ON menu_items(tenant_id, category, macro_category);

CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_excluded
ON menu_items(tenant_id, is_excluded)
WHERE is_excluded = FALSE;

-- Analyze tables to update statistics after index creation
-- (Run this manually or it will happen automatically)
-- ANALYZE transactions;
-- ANALYZE menu_items;
