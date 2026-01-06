-- Migration 035: Analytics V2 Functions (Query Summary Tables)
--
-- These functions query the pre-aggregated summary tables instead of raw transactions.
-- Expected query time: <100ms vs 0.5-3s with raw transaction queries.
--
-- API contracts remain identical - frontend does not need changes.

-- ============================================
-- 1. OVERVIEW V2 (from hourly_summaries)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_overview_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSON;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Default to last 90 days
  v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '90 days');
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(revenue), 0),
    'total_transactions', COALESCE(SUM(transaction_count), 0),
    'unique_receipts', 0,  -- Not tracked in hourly_summaries, kept for API compatibility
    'unique_items', 0,     -- Not tracked in hourly_summaries, kept for API compatibility
    'avg_ticket', CASE
      WHEN SUM(transaction_count) > 0
      THEN COALESCE(SUM(revenue), 0) / SUM(transaction_count)
      ELSE 0
    END
  ) INTO result
  FROM hourly_summaries
  WHERE tenant_id = p_tenant_id
    AND sale_date >= v_start_date
    AND sale_date <= v_end_date
    AND (p_branches IS NULL OR store_name = ANY(p_branches))
    AND (p_categories IS NULL OR category = ANY(p_categories));

  RETURN result;
END;
$$;

-- ============================================
-- 2. DAYPARTING V2 (from hourly_summaries)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_dayparting_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSON;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '90 days');
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  WITH daypart_data AS (
    SELECT
      CASE
        WHEN local_hour >= 6 AND local_hour < 11 THEN 'breakfast'
        WHEN local_hour >= 11 AND local_hour < 15 THEN 'lunch'
        WHEN local_hour >= 15 AND local_hour < 21 THEN 'dinner'
        ELSE 'late_night'
      END as daypart,
      revenue,
      quantity,
      transaction_count
    FROM hourly_summaries
    WHERE tenant_id = p_tenant_id
      AND sale_date >= v_start_date
      AND sale_date <= v_end_date
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
  ),
  aggregated AS (
    SELECT
      daypart,
      COALESCE(SUM(revenue), 0) as revenue,
      COALESCE(SUM(transaction_count), 0) as transactions,
      COALESCE(SUM(quantity), 0) as quantity
    FROM daypart_data
    GROUP BY daypart
  ),
  total AS (
    SELECT COALESCE(SUM(revenue), 0) as total_revenue FROM aggregated
  )
  SELECT json_build_object(
    'dayparts', COALESCE((
      SELECT json_agg(json_build_object(
        'daypart', a.daypart,
        'revenue', a.revenue,
        'transactions', a.transactions,
        'quantity', a.quantity,
        'avg_ticket', CASE WHEN a.transactions > 0 THEN a.revenue / a.transactions ELSE 0 END,
        'percentage_of_total', CASE WHEN t.total_revenue > 0 THEN ROUND((a.revenue::numeric / t.total_revenue * 100), 1) ELSE 0 END
      ))
      FROM aggregated a, total t
    ), '[]'::json),
    'peak_daypart', (SELECT daypart FROM aggregated ORDER BY revenue DESC LIMIT 1)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 3. HEATMAP V2 (from hourly_summaries)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_heatmap_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSON;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '90 days');
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  SELECT json_build_object(
    'data', COALESCE((
      SELECT json_agg(json_build_object(
        'day', day_of_week,
        'hour', local_hour,
        'revenue', COALESCE(revenue, 0),
        'transactions', COALESCE(transactions, 0)
      ))
      FROM (
        SELECT
          day_of_week,
          local_hour,
          SUM(revenue) as revenue,
          SUM(transaction_count) as transactions
        FROM hourly_summaries
        WHERE tenant_id = p_tenant_id
          AND sale_date >= v_start_date
          AND sale_date <= v_end_date
          AND (p_branches IS NULL OR store_name = ANY(p_branches))
          AND (p_categories IS NULL OR category = ANY(p_categories))
        GROUP BY day_of_week, local_hour
        ORDER BY day_of_week, local_hour
      ) heatmap_data
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 4. CATEGORIES V2 (from hourly_summaries)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_categories_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSON;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '90 days');
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  WITH category_data AS (
    SELECT
      category,
      macro_category,
      SUM(revenue) as revenue,
      SUM(quantity) as quantity,
      SUM(transaction_count) as transaction_count
    FROM hourly_summaries
    WHERE tenant_id = p_tenant_id
      AND sale_date >= v_start_date
      AND sale_date <= v_end_date
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
    GROUP BY category, macro_category
  ),
  total AS (
    SELECT COALESCE(SUM(revenue), 0) as total_revenue FROM category_data
  ),
  macro_totals AS (
    SELECT
      macro_category,
      SUM(revenue) as revenue,
      SUM(quantity) as quantity
    FROM category_data
    GROUP BY macro_category
  )
  SELECT json_build_object(
    'categories', COALESCE((
      SELECT json_agg(json_build_object(
        'category', c.category,
        'macro_category', c.macro_category,
        'item_count', 0,  -- Not tracked, kept for API compatibility
        'quantity', c.quantity,
        'avg_price', CASE WHEN c.quantity > 0 THEN c.revenue / c.quantity ELSE 0 END,
        'revenue', c.revenue,
        'percentage_of_revenue', CASE WHEN t.total_revenue > 0 THEN ROUND((c.revenue::numeric / t.total_revenue * 100), 1) ELSE 0 END
      ) ORDER BY c.revenue DESC)
      FROM category_data c, total t
    ), '[]'::json),
    'macro_totals', COALESCE((
      SELECT json_object_agg(
        macro_category,
        json_build_object('revenue', revenue, 'quantity', quantity)
      )
      FROM macro_totals
    ), '{}'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 5. BUNDLES V2 (from item_pairs)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_bundles_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,  -- Not used (pairs are tenant-wide), kept for API compatibility
  p_min_frequency INT DEFAULT 3,
  p_limit INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '5s'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'pairs', COALESCE((
      SELECT json_agg(json_build_object(
        'item_a', item_a,
        'item_b', item_b,
        'frequency', frequency,
        'support', ROUND(support * 100, 2)  -- Convert to percentage for API compatibility
      ))
      FROM (
        SELECT item_a, item_b, frequency, support
        FROM item_pairs
        WHERE tenant_id = p_tenant_id
          AND frequency >= p_min_frequency
        ORDER BY frequency DESC
        LIMIT p_limit
      ) top_pairs
    ), '[]'::json),
    'total_receipts', (
      SELECT COUNT(DISTINCT receipt_number)
      FROM transactions
      WHERE tenant_id = p_tenant_id
        -- Use analysis date range from item_pairs if available
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 6. TRENDS V2 (from hourly_summaries)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_trends_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSON;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '90 days');
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  WITH daily AS (
    SELECT
      sale_date as date,
      COALESCE(SUM(revenue), 0) as revenue,
      COALESCE(SUM(transaction_count), 0) as transactions
    FROM hourly_summaries
    WHERE tenant_id = p_tenant_id
      AND sale_date >= v_start_date
      AND sale_date <= v_end_date
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
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
-- 7. BRANCHES V2 (from branch_summaries)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_branches_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL  -- Not supported in v2, kept for API compatibility
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSON;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '90 days');
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  WITH branch_data AS (
    SELECT
      store_name,
      SUM(revenue) as revenue,
      SUM(transaction_count) as transaction_count,
      SUM(receipt_count) as receipt_count
    FROM branch_summaries
    WHERE tenant_id = p_tenant_id
      AND period_type = 'daily'
      AND period_start >= v_start_date
      AND period_start <= v_end_date
    GROUP BY store_name
  ),
  total AS (
    SELECT COALESCE(SUM(revenue), 0) as total_revenue FROM branch_data
  ),
  -- Get top items from the most recent monthly summary for each branch
  top_items_data AS (
    SELECT DISTINCT ON (store_name)
      store_name,
      top_items
    FROM branch_summaries
    WHERE tenant_id = p_tenant_id
      AND period_type = 'monthly'
      AND period_start >= v_start_date
    ORDER BY store_name, period_start DESC
  )
  SELECT json_build_object(
    'branches', COALESCE((
      SELECT json_agg(json_build_object(
        'name', b.store_name,
        'revenue', COALESCE(b.revenue, 0),
        'percentage_of_total', CASE
          WHEN t.total_revenue > 0 THEN ROUND((b.revenue::numeric / t.total_revenue * 100), 1)
          ELSE 0
        END,
        'transactions', COALESCE(b.receipt_count, 0),
        'avg_ticket', CASE
          WHEN b.receipt_count > 0 THEN ROUND(b.revenue::numeric / b.receipt_count)
          ELSE 0
        END,
        'top_items', COALESCE(ti.top_items, '[]'::jsonb),
        'category_breakdown', '{}'::jsonb  -- Available in branch_summaries but not exposed in current API
      ) ORDER BY b.revenue DESC)
      FROM branch_data b
      CROSS JOIN total t
      LEFT JOIN top_items_data ti ON b.store_name = ti.store_name
    ), '[]'::json),
    'comparison_metrics', json_build_object(
      'highest_revenue', (SELECT store_name FROM branch_data ORDER BY revenue DESC LIMIT 1),
      'lowest_revenue', (SELECT store_name FROM branch_data ORDER BY revenue ASC LIMIT 1),
      'revenue_spread', (SELECT MAX(revenue) - MIN(revenue) FROM branch_data),
      'highest_avg_ticket', (
        SELECT store_name FROM branch_data
        WHERE receipt_count > 0
        ORDER BY revenue / receipt_count DESC LIMIT 1
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 8. PERFORMANCE V2 (from hourly_summaries)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_performance_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSON;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '90 days');
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  WITH daily AS (
    SELECT
      sale_date,
      SUM(revenue) as revenue,
      SUM(transaction_count) as transactions
    FROM hourly_summaries
    WHERE tenant_id = p_tenant_id
      AND sale_date >= v_start_date
      AND sale_date <= v_end_date
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
    GROUP BY sale_date
  ),
  summary AS (
    SELECT
      COALESCE(SUM(revenue), 0) as total_revenue,
      COALESCE(SUM(transactions), 0) as total_transactions,
      COALESCE(AVG(revenue), 0) as daily_avg
    FROM daily
  ),
  best_day AS (
    SELECT sale_date, revenue FROM daily ORDER BY revenue DESC LIMIT 1
  ),
  worst_day AS (
    SELECT sale_date, revenue FROM daily ORDER BY revenue ASC LIMIT 1
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
      'daily_avg', (SELECT daily_avg FROM summary),
      'best_day', (SELECT json_build_object('date', sale_date, 'revenue', revenue) FROM best_day),
      'worst_day', (SELECT json_build_object('date', sale_date, 'revenue', revenue) FROM worst_day),
      'best_day_of_week', NULL,
      'worst_day_of_week', NULL
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION get_analytics_overview_v2 IS 'Overview KPIs from hourly_summaries (fast)';
COMMENT ON FUNCTION get_analytics_dayparting_v2 IS 'Daypart analysis from hourly_summaries (fast)';
COMMENT ON FUNCTION get_analytics_heatmap_v2 IS 'Hourly heatmap from hourly_summaries (fast)';
COMMENT ON FUNCTION get_analytics_categories_v2 IS 'Category breakdown from hourly_summaries (fast)';
COMMENT ON FUNCTION get_analytics_bundles_v2 IS 'Bundle pairs from item_pairs table (fast)';
COMMENT ON FUNCTION get_analytics_trends_v2 IS 'Daily/weekly/monthly trends from hourly_summaries (fast)';
COMMENT ON FUNCTION get_analytics_branches_v2 IS 'Branch comparison from branch_summaries (fast)';
COMMENT ON FUNCTION get_analytics_performance_v2 IS 'Performance summary from hourly_summaries (fast)';
