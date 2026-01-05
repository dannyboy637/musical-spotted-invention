-- Migration: Create get_analytics_bundles RPC function
-- Purpose: Database-level bundle/pair aggregation for fast performance
-- This replaces the Python-based pagination + client-side pair generation

CREATE OR REPLACE FUNCTION get_analytics_bundles(
  p_tenant_id UUID,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_min_frequency INT DEFAULT 3,
  p_limit INT DEFAULT 20
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH receipt_items AS (
    -- Get unique items per receipt (deduplicated)
    SELECT DISTINCT
      receipt_number,
      item_name
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND is_excluded = FALSE
      AND item_name IS NOT NULL
      AND receipt_number IS NOT NULL
      AND (p_start_date IS NULL OR receipt_timestamp >= p_start_date::timestamptz)
      AND (p_end_date IS NULL OR receipt_timestamp <= (p_end_date || 'T23:59:59')::timestamptz)
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
  ),
  pairs AS (
    -- Self-join to find all item pairs on same receipt
    SELECT
      LEAST(a.item_name, b.item_name) as item_a,
      GREATEST(a.item_name, b.item_name) as item_b,
      COUNT(DISTINCT a.receipt_number) as frequency
    FROM receipt_items a
    JOIN receipt_items b
      ON a.receipt_number = b.receipt_number
      AND a.item_name < b.item_name
    GROUP BY 1, 2
    HAVING COUNT(DISTINCT a.receipt_number) >= p_min_frequency
    ORDER BY frequency DESC
    LIMIT p_limit
  ),
  total_receipts AS (
    SELECT COUNT(DISTINCT receipt_number) as cnt
    FROM receipt_items
  )
  SELECT json_build_object(
    'pairs', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'item_a', p.item_a,
          'item_b', p.item_b,
          'frequency', p.frequency,
          'support', ROUND((p.frequency::numeric / NULLIF(t.cnt, 0) * 100), 2)
        )
      )
      FROM pairs p, total_receipts t),
      '[]'::json
    ),
    'total_receipts', (SELECT cnt FROM total_receipts)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION get_analytics_bundles IS
'Fast database-level bundle/pair analysis.
Returns frequently co-purchased item pairs from transactions.
Much faster than the previous Python-based pagination approach.';
