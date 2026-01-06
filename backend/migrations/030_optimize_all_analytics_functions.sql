-- Migration 030: Comprehensive Analytics Function Optimization
--
-- This migration optimizes ALL analytics RPC functions for large datasets (600k+ rows).
--
-- Key improvements:
-- 1. Replace receipt_timestamp::date casts with TIMESTAMPTZ comparisons (enables index usage)
-- 2. Default to last 90 days when no date range specified (prevents full-table scans)
-- 3. Add MATERIALIZED to CTEs (prevents redundant computation)
-- 4. Set statement_timeout = '30s' per function (graceful timeout handling)
-- 5. Fix timezone conversions (compute once, reuse)
-- 6. Replace correlated subqueries with JOINs
-- 7. Add missing indexes
--
-- Run this AFTER migrations 001-029. This REPLACES functions from 009 and 029.

-- ============================================
-- HELPER: Calculate default date range (90 days)
-- ============================================

-- ============================================
-- 1. OVERVIEW AGGREGATION (Optimized)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_overview(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSON;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Default to last 90 days if no date range specified
  v_start_ts := CASE
    WHEN p_start_date IS NOT NULL THEN p_start_date::timestamptz
    WHEN p_end_date IS NOT NULL THEN (p_end_date - INTERVAL '90 days')::timestamptz
    ELSE (CURRENT_DATE - INTERVAL '90 days')::timestamptz
  END;
  v_end_ts := CASE
    WHEN p_end_date IS NOT NULL THEN (p_end_date + 1)::timestamptz
    ELSE (CURRENT_DATE + 1)::timestamptz
  END;

  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(gross_revenue), 0),
    'total_transactions', COUNT(*),
    'unique_receipts', COUNT(DISTINCT receipt_number),
    'unique_items', COUNT(DISTINCT item_name),
    'avg_ticket', CASE
      WHEN COUNT(DISTINCT receipt_number) > 0
      THEN COALESCE(SUM(gross_revenue), 0) / COUNT(DISTINCT receipt_number)
      ELSE 0
    END
  ) INTO result
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND receipt_timestamp >= v_start_ts
    AND receipt_timestamp < v_end_ts
    AND (p_branches IS NULL OR store_name = ANY(p_branches))
    AND (p_categories IS NULL OR category = ANY(p_categories));

  RETURN result;
END;
$$;

-- ============================================
-- 2. DAYPARTING AGGREGATION (Optimized)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_dayparting(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSON;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Default to last 90 days
  v_start_ts := CASE
    WHEN p_start_date IS NOT NULL THEN p_start_date::timestamptz
    WHEN p_end_date IS NOT NULL THEN (p_end_date - INTERVAL '90 days')::timestamptz
    ELSE (CURRENT_DATE - INTERVAL '90 days')::timestamptz
  END;
  v_end_ts := CASE
    WHEN p_end_date IS NOT NULL THEN (p_end_date + 1)::timestamptz
    ELSE (CURRENT_DATE + 1)::timestamptz
  END;

  -- Compute timezone conversion ONCE per row in base CTE
  WITH base_data AS MATERIALIZED (
    SELECT
      gross_revenue,
      quantity,
      receipt_number,
      -- Compute local hour ONCE (instead of 6 times in original)
      EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila')::int as local_hour
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND receipt_timestamp >= v_start_ts
      AND receipt_timestamp < v_end_ts
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
  ),
  daypart_data AS MATERIALIZED (
    SELECT
      CASE
        WHEN local_hour >= 6 AND local_hour < 11 THEN 'breakfast'
        WHEN local_hour >= 11 AND local_hour < 15 THEN 'lunch'
        WHEN local_hour >= 15 AND local_hour < 21 THEN 'dinner'
        ELSE 'late_night'
      END as daypart,
      gross_revenue,
      quantity,
      receipt_number
    FROM base_data
  ),
  aggregated AS MATERIALIZED (
    SELECT
      daypart,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(*) as transactions,
      COALESCE(SUM(quantity), 0) as quantity,
      COUNT(DISTINCT receipt_number) as unique_receipts
    FROM daypart_data
    GROUP BY daypart
  ),
  total AS (
    SELECT COALESCE(SUM(revenue), 0) as total_revenue FROM aggregated
  )
  SELECT json_build_object(
    'dayparts', (
      SELECT COALESCE(json_agg(json_build_object(
        'daypart', a.daypart,
        'revenue', a.revenue,
        'transactions', a.transactions,
        'quantity', a.quantity,
        'avg_ticket', CASE WHEN a.unique_receipts > 0 THEN a.revenue / a.unique_receipts ELSE 0 END,
        'percentage_of_total', CASE WHEN t.total_revenue > 0 THEN ROUND((a.revenue::numeric / t.total_revenue * 100), 1) ELSE 0 END
      )), '[]'::json)
      FROM aggregated a, total t
    ),
    'peak_daypart', (SELECT daypart FROM aggregated ORDER BY revenue DESC LIMIT 1)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 3. HOURLY HEATMAP AGGREGATION (Optimized)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_heatmap(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSON;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Default to last 90 days
  v_start_ts := CASE
    WHEN p_start_date IS NOT NULL THEN p_start_date::timestamptz
    WHEN p_end_date IS NOT NULL THEN (p_end_date - INTERVAL '90 days')::timestamptz
    ELSE (CURRENT_DATE - INTERVAL '90 days')::timestamptz
  END;
  v_end_ts := CASE
    WHEN p_end_date IS NOT NULL THEN (p_end_date + 1)::timestamptz
    ELSE (CURRENT_DATE + 1)::timestamptz
  END;

  -- Compute timezone conversion ONCE per row
  WITH base_data AS MATERIALIZED (
    SELECT
      gross_revenue,
      receipt_number,
      -- Compute local timestamp ONCE (instead of twice in original)
      receipt_timestamp AT TIME ZONE 'Asia/Manila' as local_ts
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND receipt_timestamp >= v_start_ts
      AND receipt_timestamp < v_end_ts
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
  )
  SELECT COALESCE(json_agg(json_build_object(
    'day', day_of_week,
    'hour', hour_of_day,
    'revenue', revenue,
    'transactions', transactions
  )), '[]'::json) INTO result
  FROM (
    SELECT
      EXTRACT(DOW FROM local_ts)::int as day_of_week,
      EXTRACT(HOUR FROM local_ts)::int as hour_of_day,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(DISTINCT receipt_number) as transactions
    FROM base_data
    GROUP BY 1, 2
    ORDER BY 1, 2
  ) heatmap;

  RETURN result;
END;
$$;

-- ============================================
-- 4. CATEGORIES AGGREGATION (Optimized)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_categories(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_include_excluded BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSON;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Default to last 90 days
  v_start_ts := CASE
    WHEN p_start_date IS NOT NULL THEN p_start_date::timestamptz
    WHEN p_end_date IS NOT NULL THEN (p_end_date - INTERVAL '90 days')::timestamptz
    ELSE (CURRENT_DATE - INTERVAL '90 days')::timestamptz
  END;
  v_end_ts := CASE
    WHEN p_end_date IS NOT NULL THEN (p_end_date + 1)::timestamptz
    ELSE (CURRENT_DATE + 1)::timestamptz
  END;

  WITH cat_data AS MATERIALIZED (
    SELECT
      COALESCE(category, 'Unknown') as category,
      COALESCE(macro_category, 'OTHER') as macro_category,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COALESCE(SUM(quantity), 0) as quantity,
      COUNT(DISTINCT item_name) as item_count
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND receipt_timestamp >= v_start_ts
      AND receipt_timestamp < v_end_ts
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_include_excluded OR is_excluded = FALSE OR is_excluded IS NULL)
    GROUP BY category, macro_category
  ),
  total AS (
    SELECT COALESCE(SUM(revenue), 0) as total_revenue FROM cat_data
  )
  SELECT json_build_object(
    'categories', (
      SELECT COALESCE(json_agg(json_build_object(
        'category', c.category,
        'macro_category', c.macro_category,
        'revenue', c.revenue,
        'quantity', c.quantity,
        'item_count', c.item_count,
        'avg_price', CASE WHEN c.quantity > 0 THEN c.revenue / c.quantity ELSE 0 END,
        'percentage_of_revenue', CASE WHEN t.total_revenue > 0 THEN ROUND((c.revenue::numeric / t.total_revenue * 100), 1) ELSE 0 END
      ) ORDER BY c.revenue DESC), '[]'::json)
      FROM cat_data c, total t
    ),
    'macro_totals', (
      SELECT COALESCE(json_object_agg(macro_category, json_build_object(
        'revenue', revenue,
        'quantity', quantity,
        'item_count', item_count
      )), '{}'::json)
      FROM (
        SELECT macro_category, SUM(revenue) as revenue, SUM(quantity) as quantity, SUM(item_count) as item_count
        FROM cat_data
        GROUP BY macro_category
      ) macro
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 5. PERFORMANCE SUMMARY AGGREGATION (Optimized)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_performance(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSON;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Default to last 90 days
  v_start_ts := CASE
    WHEN p_start_date IS NOT NULL THEN p_start_date::timestamptz
    WHEN p_end_date IS NOT NULL THEN (p_end_date - INTERVAL '90 days')::timestamptz
    ELSE (CURRENT_DATE - INTERVAL '90 days')::timestamptz
  END;
  v_end_ts := CASE
    WHEN p_end_date IS NOT NULL THEN (p_end_date + 1)::timestamptz
    ELSE (CURRENT_DATE + 1)::timestamptz
  END;

  -- Single pass base data (used for all aggregations)
  WITH base_data AS MATERIALIZED (
    SELECT
      (receipt_timestamp AT TIME ZONE 'Asia/Manila')::date as sale_date,
      gross_revenue,
      receipt_number,
      store_name
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND receipt_timestamp >= v_start_ts
      AND receipt_timestamp < v_end_ts
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
  ),
  daily_data AS MATERIALIZED (
    SELECT
      sale_date,
      COALESCE(SUM(gross_revenue), 0) as revenue
    FROM base_data
    GROUP BY sale_date
  ),
  summary AS (
    SELECT
      COALESCE(SUM(gross_revenue), 0) as total_revenue,
      COUNT(DISTINCT receipt_number) as total_transactions
    FROM base_data
  ),
  branch_data AS MATERIALIZED (
    SELECT
      COALESCE(store_name, 'Main') as branch_name,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(DISTINCT receipt_number) as transactions
    FROM base_data
    GROUP BY store_name
    HAVING COUNT(*) > 0
  ),
  -- Pre-compute best/worst day to avoid correlated subqueries
  best_day AS (
    SELECT sale_date, revenue FROM daily_data ORDER BY revenue DESC LIMIT 1
  ),
  worst_day AS (
    SELECT sale_date, revenue FROM daily_data WHERE revenue > 0 ORDER BY revenue ASC LIMIT 1
  )
  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'total_revenue', total_revenue,
        'total_transactions', total_transactions,
        'avg_ticket', CASE WHEN total_transactions > 0 THEN total_revenue / total_transactions ELSE 0 END
      ) FROM summary
    ),
    'trends', json_build_object(
      'daily_avg', (SELECT COALESCE(AVG(revenue), 0) FROM daily_data),
      'best_day', (SELECT json_build_object('date', sale_date, 'revenue', revenue) FROM best_day),
      'worst_day', (SELECT json_build_object('date', sale_date, 'revenue', revenue) FROM worst_day)
    ),
    'branches', (
      SELECT COALESCE(json_agg(json_build_object(
        'name', branch_name,
        'revenue', revenue,
        'transactions', transactions,
        'avg_ticket', CASE WHEN transactions > 0 THEN revenue / transactions ELSE 0 END
      ) ORDER BY revenue DESC), '[]'::json)
      FROM branch_data
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 6. PERFORMANCE TRENDS AGGREGATION (Optimized)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_trends(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSON;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Default to last 90 days
  v_start_ts := CASE
    WHEN p_start_date IS NOT NULL THEN p_start_date::timestamptz
    WHEN p_end_date IS NOT NULL THEN (p_end_date - INTERVAL '90 days')::timestamptz
    ELSE (CURRENT_DATE - INTERVAL '90 days')::timestamptz
  END;
  v_end_ts := CASE
    WHEN p_end_date IS NOT NULL THEN (p_end_date + 1)::timestamptz
    ELSE (CURRENT_DATE + 1)::timestamptz
  END;

  WITH base_data AS MATERIALIZED (
    SELECT
      (receipt_timestamp AT TIME ZONE 'Asia/Manila')::date as sale_date,
      gross_revenue,
      receipt_number
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND receipt_timestamp >= v_start_ts
      AND receipt_timestamp < v_end_ts
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
  ),
  daily AS MATERIALIZED (
    SELECT
      sale_date as date,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(*) as transactions
    FROM base_data
    GROUP BY sale_date
    ORDER BY sale_date
  ),
  weekly AS (
    SELECT
      TO_CHAR(date, 'IYYY-"W"IW') as week,
      COALESCE(SUM(revenue), 0) as revenue,
      SUM(transactions) as transactions
    FROM daily
    GROUP BY TO_CHAR(date, 'IYYY-"W"IW')
    ORDER BY week
  ),
  monthly AS (
    SELECT
      TO_CHAR(date, 'YYYY-MM') as month,
      COALESCE(SUM(revenue), 0) as revenue,
      SUM(transactions) as transactions
    FROM daily
    GROUP BY TO_CHAR(date, 'YYYY-MM')
    ORDER BY month
  )
  SELECT json_build_object(
    'daily', (SELECT COALESCE(json_agg(json_build_object('date', date, 'revenue', revenue, 'transactions', transactions)), '[]'::json) FROM daily),
    'weekly', (SELECT COALESCE(json_agg(json_build_object('week', week, 'revenue', revenue, 'transactions', transactions)), '[]'::json) FROM weekly),
    'monthly', (SELECT COALESCE(json_agg(json_build_object('month', month, 'revenue', revenue, 'transactions', transactions)), '[]'::json) FROM monthly),
    'growth_metrics', json_build_object(
      'month_over_month', NULL,
      'week_over_week', NULL
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 7. BRANCHES DETAILED AGGREGATION (Optimized)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_branches(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSON;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Default to last 90 days
  v_start_ts := CASE
    WHEN p_start_date IS NOT NULL THEN p_start_date::timestamptz
    WHEN p_end_date IS NOT NULL THEN (p_end_date - INTERVAL '90 days')::timestamptz
    ELSE (CURRENT_DATE - INTERVAL '90 days')::timestamptz
  END;
  v_end_ts := CASE
    WHEN p_end_date IS NOT NULL THEN (p_end_date + 1)::timestamptz
    ELSE (CURRENT_DATE + 1)::timestamptz
  END;

  WITH
  -- Main aggregation - single pass over data
  branch_agg AS MATERIALIZED (
    SELECT
      COALESCE(store_name, 'Main') as branch_name,
      SUM(gross_revenue) as revenue,
      COUNT(DISTINCT receipt_number) as transactions,
      jsonb_object_agg(
        COALESCE(macro_category, 'OTHER'),
        cat_rev
      ) FILTER (WHERE cat_rev > 0) as category_breakdown
    FROM (
      SELECT
        store_name,
        gross_revenue,
        receipt_number,
        macro_category,
        SUM(gross_revenue) OVER (PARTITION BY store_name, macro_category) as cat_rev
      FROM transactions
      WHERE tenant_id = p_tenant_id
        AND receipt_timestamp >= v_start_ts
        AND receipt_timestamp < v_end_ts
        AND (p_categories IS NULL OR category = ANY(p_categories))
    ) sub
    GROUP BY COALESCE(store_name, 'Main')
  ),
  -- Top items per branch - separate query for efficiency
  top_items AS MATERIALIZED (
    SELECT
      branch_name,
      jsonb_agg(
        jsonb_build_object('item', item_name, 'quantity', total_qty)
        ORDER BY total_qty DESC
      ) as items
    FROM (
      SELECT
        COALESCE(store_name, 'Main') as branch_name,
        item_name,
        SUM(quantity) as total_qty,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(store_name, 'Main')
          ORDER BY SUM(quantity) DESC
        ) as rn
      FROM transactions
      WHERE tenant_id = p_tenant_id
        AND item_name IS NOT NULL
        AND receipt_timestamp >= v_start_ts
        AND receipt_timestamp < v_end_ts
        AND (p_categories IS NULL OR category = ANY(p_categories))
      GROUP BY COALESCE(store_name, 'Main'), item_name
    ) ranked
    WHERE rn <= 3
    GROUP BY branch_name
  ),
  -- Calculate totals
  totals AS (
    SELECT COALESCE(SUM(revenue), 0) as total_revenue FROM branch_agg
  )
  SELECT jsonb_build_object(
    'branches', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', b.branch_name,
          'revenue', COALESCE(b.revenue, 0),
          'percentage_of_total', CASE
            WHEN t.total_revenue > 0 THEN ROUND((b.revenue::numeric / t.total_revenue * 100), 1)
            ELSE 0
          END,
          'transactions', COALESCE(b.transactions, 0),
          'avg_ticket', CASE
            WHEN b.transactions > 0 THEN ROUND(b.revenue::numeric / b.transactions)
            ELSE 0
          END,
          'top_items', COALESCE(ti.items, '[]'::jsonb),
          'category_breakdown', COALESCE(b.category_breakdown, '{}'::jsonb)
        )
        ORDER BY b.revenue DESC
      )
      FROM branch_agg b
      CROSS JOIN totals t
      LEFT JOIN top_items ti ON ti.branch_name = b.branch_name
    ), '[]'::jsonb),
    'comparison_metrics', (
      SELECT jsonb_build_object(
        'highest_revenue', (SELECT branch_name FROM branch_agg ORDER BY revenue DESC LIMIT 1),
        'lowest_revenue', (SELECT branch_name FROM branch_agg ORDER BY revenue ASC LIMIT 1),
        'revenue_spread', (SELECT COALESCE(MAX(revenue) - MIN(revenue), 0) FROM branch_agg),
        'highest_avg_ticket', (
          SELECT branch_name FROM branch_agg
          WHERE transactions > 0
          ORDER BY revenue / transactions DESC
          LIMIT 1
        )
      )
    )
  )::json INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 8. BUNDLES ANALYSIS (Optimized with 90-day limit)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_bundles(
  p_tenant_id UUID,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_min_frequency INT DEFAULT 3,
  p_limit INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSON;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Bundle analysis limited to 90 days max to prevent O(n^2) explosion
  -- If no dates specified, default to last 90 days
  v_end_ts := CASE
    WHEN p_end_date IS NOT NULL THEN (p_end_date || 'T23:59:59')::timestamptz
    ELSE NOW()
  END;
  v_start_ts := CASE
    WHEN p_start_date IS NOT NULL THEN p_start_date::timestamptz
    ELSE GREATEST(
      (CURRENT_DATE - INTERVAL '90 days')::timestamptz,
      COALESCE(p_start_date::timestamptz, (CURRENT_DATE - INTERVAL '90 days')::timestamptz)
    )
  END;

  -- Enforce 90-day max even if user specifies longer range
  IF v_start_ts < v_end_ts - INTERVAL '90 days' THEN
    v_start_ts := v_end_ts - INTERVAL '90 days';
  END IF;

  WITH receipt_items AS MATERIALIZED (
    -- Get unique items per receipt (deduplicated)
    SELECT DISTINCT
      receipt_number,
      item_name
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND is_excluded = FALSE
      AND item_name IS NOT NULL
      AND receipt_number IS NOT NULL
      AND receipt_timestamp >= v_start_ts
      AND receipt_timestamp < v_end_ts
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
  ),
  pairs AS MATERIALIZED (
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
    'total_receipts', (SELECT cnt FROM total_receipts),
    'date_range_limited', TRUE,
    'analysis_start', v_start_ts::date,
    'analysis_end', v_end_ts::date
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 9. ADD MISSING INDEXES
-- ============================================

-- Composite index for bundle analysis (critical for self-join)
CREATE INDEX IF NOT EXISTS idx_transactions_bundle_analysis
ON transactions(tenant_id, receipt_number, item_name)
WHERE item_name IS NOT NULL AND is_excluded = FALSE;

-- Index for distinct item counting (overview endpoint)
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_item_name
ON transactions(tenant_id, item_name)
WHERE item_name IS NOT NULL;

-- Ensure primary analytics index exists
CREATE INDEX IF NOT EXISTS idx_transactions_analytics_main
ON transactions(tenant_id, receipt_timestamp DESC);

-- ============================================
-- 10. UPDATE TABLE STATISTICS
-- ============================================
-- Critical after large data imports for query planner optimization
ANALYZE transactions;
ANALYZE menu_items;

-- ============================================
-- 11. GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION get_analytics_overview TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_dayparting TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_heatmap TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_categories TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_performance TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_trends TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_branches TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_bundles TO authenticated;

-- ============================================
-- MIGRATION NOTES
-- ============================================
-- This migration replaces functions from:
-- - 009_create_analytics_rpc_functions.sql
-- - 029_optimize_analytics_branches.sql
-- - 011_create_bundles_rpc.sql (bundles function only)
--
-- Performance improvements:
-- - All functions now use TIMESTAMPTZ comparisons (enables index usage)
-- - All functions default to 90-day range (prevents full-table scans)
-- - MATERIALIZED CTEs prevent redundant computation
-- - Timezone conversions computed once per row
-- - Correlated subqueries replaced with JOINs
-- - Bundle analysis hard-limited to 90 days to prevent O(n^2) explosion
--
-- Expected results:
-- - Overview: 2-30s -> 0.5-2s
-- - Dayparting: 15-45s -> 1-3s
-- - Heatmap: 12-30s -> 1-3s
-- - Categories: 3-8s -> 0.5-2s
-- - Performance: 5-15s -> 1-3s
-- - Trends: 3-8s -> 1-3s
-- - Branches: 30-60s -> 2-5s
-- - Bundles: 20-40s -> 3-8s
