-- Migration 031: Create hourly_summaries table
--
-- Pre-aggregated hourly data for fast dashboard queries.
-- Covers: Overview, Dayparting, Heatmap, Categories, Performance, Trends
--
-- Expected rows: ~50-100k per tenant per year (sparse hours)
-- Query time: <100ms vs 0.5-3s from raw transactions

-- ============================================
-- TABLE: hourly_summaries
-- ============================================
CREATE TABLE IF NOT EXISTS hourly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Time dimensions
  sale_date DATE NOT NULL,                                              -- Local date (Manila timezone)
  local_hour INT NOT NULL CHECK (local_hour >= 0 AND local_hour <= 23), -- Hour 0-23 (Manila timezone)
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday

  -- Grouping dimensions (no NULL rollups - compute totals with SUM at query time)
  store_name TEXT NOT NULL,
  category TEXT NOT NULL,
  macro_category TEXT NOT NULL,

  -- Metrics (revenue in centavos to match transactions.gross_revenue)
  revenue BIGINT NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  transaction_count INT NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for upserts during refresh
  CONSTRAINT hourly_summaries_unique
    UNIQUE (tenant_id, sale_date, local_hour, store_name, category)
);

-- ============================================
-- INDEXES for common query patterns
-- ============================================

-- Primary lookup: tenant + date range (most common filter)
CREATE INDEX IF NOT EXISTS idx_hourly_tenant_date
  ON hourly_summaries(tenant_id, sale_date);

-- Heatmap queries: tenant + day_of_week + hour
CREATE INDEX IF NOT EXISTS idx_hourly_tenant_dow_hour
  ON hourly_summaries(tenant_id, day_of_week, local_hour);

-- Branch filtering
CREATE INDEX IF NOT EXISTS idx_hourly_tenant_store
  ON hourly_summaries(tenant_id, store_name);

-- Category/macro filtering
CREATE INDEX IF NOT EXISTS idx_hourly_tenant_macro
  ON hourly_summaries(tenant_id, macro_category);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE hourly_summaries ENABLE ROW LEVEL SECURITY;

-- Operators can see all tenants
CREATE POLICY hourly_summaries_operator_all ON hourly_summaries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'operator'
    )
  );

-- Owners/viewers can only see their own tenant
CREATE POLICY hourly_summaries_tenant_read ON hourly_summaries
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT users.tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

-- ============================================
-- COMMENTS for documentation
-- ============================================
COMMENT ON TABLE hourly_summaries IS 'Pre-aggregated hourly sales data for fast dashboard queries';
COMMENT ON COLUMN hourly_summaries.sale_date IS 'Local date in Manila timezone';
COMMENT ON COLUMN hourly_summaries.local_hour IS 'Hour 0-23 in Manila timezone';
COMMENT ON COLUMN hourly_summaries.day_of_week IS '0=Sunday through 6=Saturday';
COMMENT ON COLUMN hourly_summaries.revenue IS 'Total gross revenue in centavos';
COMMENT ON COLUMN hourly_summaries.transaction_count IS 'Number of line items (not receipts)';
