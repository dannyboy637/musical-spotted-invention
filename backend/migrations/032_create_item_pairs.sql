-- Migration 032: Create item_pairs table
--
-- Pre-computed item pair frequencies for bundle analysis.
-- Covers: Bundles endpoint, Recommendations page
--
-- Expected rows: ~200-1000 per tenant (top pairs only)
-- Query time: <50ms vs 3-8s from self-join on transactions
--
-- The self-join analysis (O(n^2)) is expensive and capped at 90 days.
-- This table stores pre-computed results, refreshed after each import.

-- ============================================
-- TABLE: item_pairs
-- ============================================
CREATE TABLE IF NOT EXISTS item_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Pair identification (alphabetically ordered: item_a < item_b)
  item_a TEXT NOT NULL,
  item_b TEXT NOT NULL,

  -- Metrics
  frequency INT NOT NULL,              -- Times these items were purchased together
  support NUMERIC(7,4),                -- % of receipts containing this pair (e.g., 0.1234 = 12.34%)

  -- Time range this analysis covers
  analysis_start DATE NOT NULL,
  analysis_end DATE NOT NULL,

  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for upserts during refresh
  CONSTRAINT item_pairs_unique
    UNIQUE (tenant_id, item_a, item_b),

  -- Ensure alphabetical ordering
  CONSTRAINT item_pairs_ordered
    CHECK (item_a < item_b)
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary lookup: tenant + frequency (for top pairs)
CREATE INDEX IF NOT EXISTS idx_pairs_tenant_freq
  ON item_pairs(tenant_id, frequency DESC);

-- Lookup by item name (for "what pairs with X?" queries)
CREATE INDEX IF NOT EXISTS idx_pairs_tenant_item_a
  ON item_pairs(tenant_id, item_a);

CREATE INDEX IF NOT EXISTS idx_pairs_tenant_item_b
  ON item_pairs(tenant_id, item_b);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE item_pairs ENABLE ROW LEVEL SECURITY;

-- Operators can see all tenants
CREATE POLICY item_pairs_operator_all ON item_pairs
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
CREATE POLICY item_pairs_tenant_read ON item_pairs
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
COMMENT ON TABLE item_pairs IS 'Pre-computed item pair frequencies for bundle analysis';
COMMENT ON COLUMN item_pairs.item_a IS 'First item in pair (alphabetically first)';
COMMENT ON COLUMN item_pairs.item_b IS 'Second item in pair (alphabetically second)';
COMMENT ON COLUMN item_pairs.frequency IS 'Number of receipts containing both items';
COMMENT ON COLUMN item_pairs.support IS 'Percentage of all receipts containing this pair (0.0-1.0)';
COMMENT ON COLUMN item_pairs.analysis_start IS 'Start date of the analysis window';
COMMENT ON COLUMN item_pairs.analysis_end IS 'End date of the analysis window';
