-- Migration 033: Create branch_summaries table
--
-- Pre-aggregated branch performance data with top items and category breakdown.
-- Covers: Branch Comparison page, branch-specific insights
--
-- Expected rows: ~4,300 per tenant (daily + weekly + monthly rollups)
-- Query time: <50ms vs 2-5s from raw transactions

-- ============================================
-- TABLE: branch_summaries
-- ============================================
CREATE TABLE IF NOT EXISTS branch_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Period granularity
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,    -- First day of the period
  store_name TEXT NOT NULL,

  -- Metrics
  revenue BIGINT NOT NULL DEFAULT 0,         -- Total gross revenue in centavos
  transaction_count INT NOT NULL DEFAULT 0,  -- Number of line items
  receipt_count INT NOT NULL DEFAULT 0,      -- Distinct receipts
  avg_ticket INT,                            -- Pre-computed average ticket (revenue / receipt_count)

  -- Pre-computed JSON aggregates (avoid joins at query time)
  top_items JSONB,              -- Top 10 items: [{item_name, quantity, revenue}, ...]
  category_breakdown JSONB,     -- Category totals: {category: {revenue, quantity}, ...}

  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for upserts during refresh
  CONSTRAINT branch_summaries_unique
    UNIQUE (tenant_id, period_type, period_start, store_name)
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary lookup: tenant + period type + date range
CREATE INDEX IF NOT EXISTS idx_branch_tenant_period
  ON branch_summaries(tenant_id, period_type, period_start);

-- Branch-specific lookup
CREATE INDEX IF NOT EXISTS idx_branch_tenant_store
  ON branch_summaries(tenant_id, store_name, period_type);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE branch_summaries ENABLE ROW LEVEL SECURITY;

-- Operators can see all tenants
CREATE POLICY branch_summaries_operator_all ON branch_summaries
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
CREATE POLICY branch_summaries_tenant_read ON branch_summaries
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT users.tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE branch_summaries IS 'Pre-aggregated branch performance with top items';
COMMENT ON COLUMN branch_summaries.period_type IS 'Granularity: daily, weekly, or monthly';
COMMENT ON COLUMN branch_summaries.period_start IS 'First day of the period (Monday for weekly, 1st for monthly)';
COMMENT ON COLUMN branch_summaries.avg_ticket IS 'Pre-computed average ticket in centavos';
COMMENT ON COLUMN branch_summaries.top_items IS 'Top 10 items: [{item_name, quantity, revenue}, ...]';
COMMENT ON COLUMN branch_summaries.category_breakdown IS 'Revenue/quantity by category: {category: {revenue, quantity}, ...}';
