-- Analytics RPC Functions
-- These functions aggregate data at the database level for fast dashboard queries
-- Instead of fetching 280k+ rows, we return aggregated results (1-100 rows)

-- ============================================
-- OVERVIEW AGGREGATION
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
AS $$
DECLARE
  result JSON;
BEGIN
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
    AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
    AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
    AND (p_branches IS NULL OR store_name = ANY(p_branches))
    AND (p_categories IS NULL OR category = ANY(p_categories));

  RETURN result;
END;
$$;

-- ============================================
-- DAYPARTING AGGREGATION
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
AS $$
DECLARE
  result JSON;
BEGIN
  WITH daypart_data AS (
    SELECT
      CASE
        WHEN EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila') >= 6
             AND EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila') < 11 THEN 'breakfast'
        WHEN EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila') >= 11
             AND EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila') < 15 THEN 'lunch'
        WHEN EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila') >= 15
             AND EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila') < 21 THEN 'dinner'
        ELSE 'late_night'
      END as daypart,
      gross_revenue,
      quantity,
      receipt_number
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
  ),
  aggregated AS (
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
      SELECT json_agg(json_build_object(
        'daypart', a.daypart,
        'revenue', a.revenue,
        'transactions', a.transactions,
        'quantity', a.quantity,
        'avg_ticket', CASE WHEN a.unique_receipts > 0 THEN a.revenue / a.unique_receipts ELSE 0 END,
        'percentage_of_total', CASE WHEN t.total_revenue > 0 THEN ROUND((a.revenue::numeric / t.total_revenue * 100), 1) ELSE 0 END
      ))
      FROM aggregated a, total t
    ),
    'peak_daypart', (SELECT daypart FROM aggregated ORDER BY revenue DESC LIMIT 1)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- HOURLY HEATMAP AGGREGATION
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
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(json_build_object(
    'day', day_of_week,
    'hour', hour_of_day,
    'revenue', revenue,
    'transactions', transactions
  )) INTO result
  FROM (
    SELECT
      EXTRACT(DOW FROM receipt_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::int as day_of_week,
      EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::int as hour_of_day,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(DISTINCT receipt_number) as transactions
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
    GROUP BY day_of_week, hour_of_day
    ORDER BY day_of_week, hour_of_day
  ) heatmap;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================
-- CATEGORIES AGGREGATION
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
AS $$
DECLARE
  result JSON;
BEGIN
  WITH cat_data AS (
    SELECT
      COALESCE(category, 'Unknown') as category,
      COALESCE(macro_category, 'OTHER') as macro_category,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COALESCE(SUM(quantity), 0) as quantity,
      COUNT(DISTINCT item_name) as item_count
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_include_excluded OR is_excluded = FALSE OR is_excluded IS NULL)
    GROUP BY category, macro_category
  ),
  total AS (
    SELECT COALESCE(SUM(revenue), 0) as total_revenue FROM cat_data
  )
  SELECT json_build_object(
    'categories', (
      SELECT json_agg(json_build_object(
        'category', c.category,
        'macro_category', c.macro_category,
        'revenue', c.revenue,
        'quantity', c.quantity,
        'item_count', c.item_count,
        'avg_price', CASE WHEN c.quantity > 0 THEN c.revenue / c.quantity ELSE 0 END,
        'percentage_of_revenue', CASE WHEN t.total_revenue > 0 THEN ROUND((c.revenue::numeric / t.total_revenue * 100), 1) ELSE 0 END
      ) ORDER BY c.revenue DESC)
      FROM cat_data c, total t
    ),
    'macro_totals', (
      SELECT json_object_agg(macro_category, json_build_object(
        'revenue', revenue,
        'quantity', quantity,
        'item_count', item_count
      ))
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
-- PERFORMANCE SUMMARY AGGREGATION
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
AS $$
DECLARE
  result JSON;
BEGIN
  WITH daily_data AS (
    SELECT
      receipt_timestamp::date as sale_date,
      COALESCE(SUM(gross_revenue), 0) as revenue
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
    GROUP BY receipt_timestamp::date
  ),
  summary AS (
    SELECT
      COALESCE(SUM(gross_revenue), 0) as total_revenue,
      COUNT(DISTINCT receipt_number) as total_transactions
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
  ),
  branch_data AS (
    SELECT
      COALESCE(store_name, 'Main') as branch_name,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(DISTINCT receipt_number) as transactions
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
      AND (p_categories IS NULL OR category = ANY(p_categories))
    GROUP BY store_name
    HAVING COUNT(*) > 0
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
      'best_day', (SELECT json_build_object('date', sale_date, 'revenue', revenue) FROM daily_data ORDER BY revenue DESC LIMIT 1),
      'worst_day', (SELECT json_build_object('date', sale_date, 'revenue', revenue) FROM daily_data WHERE revenue > 0 ORDER BY revenue ASC LIMIT 1)
    ),
    'branches', (
      SELECT json_agg(json_build_object(
        'name', branch_name,
        'revenue', revenue,
        'transactions', transactions,
        'avg_ticket', CASE WHEN transactions > 0 THEN revenue / transactions ELSE 0 END
      ) ORDER BY revenue DESC)
      FROM branch_data
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- PERFORMANCE TRENDS AGGREGATION
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
AS $$
DECLARE
  result JSON;
BEGIN
  WITH base_data AS (
    SELECT
      receipt_timestamp::date as sale_date,
      gross_revenue,
      receipt_number
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
      AND (p_branches IS NULL OR store_name = ANY(p_branches))
      AND (p_categories IS NULL OR category = ANY(p_categories))
  ),
  daily AS (
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
      TO_CHAR(sale_date, 'IYYY-"W"IW') as week,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(*) as transactions
    FROM base_data
    GROUP BY TO_CHAR(sale_date, 'IYYY-"W"IW')
    ORDER BY week
  ),
  monthly AS (
    SELECT
      TO_CHAR(sale_date, 'YYYY-MM') as month,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(*) as transactions
    FROM base_data
    GROUP BY TO_CHAR(sale_date, 'YYYY-MM')
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
-- BRANCHES DETAILED AGGREGATION
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
AS $$
DECLARE
  result JSON;
BEGIN
  WITH branch_base AS (
    SELECT
      COALESCE(store_name, 'Main') as branch_name,
      gross_revenue,
      receipt_number,
      item_name,
      quantity,
      COALESCE(macro_category, 'OTHER') as macro_category
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
      AND (p_categories IS NULL OR category = ANY(p_categories))
  ),
  branch_summary AS (
    SELECT
      branch_name,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(DISTINCT receipt_number) as transactions
    FROM branch_base
    GROUP BY branch_name
  ),
  total_revenue AS (
    SELECT COALESCE(SUM(revenue), 0) as total FROM branch_summary
  ),
  branch_top_items AS (
    SELECT DISTINCT ON (branch_name, rn)
      branch_name,
      item_name,
      total_qty,
      rn
    FROM (
      SELECT
        branch_name,
        item_name,
        SUM(quantity) as total_qty,
        ROW_NUMBER() OVER (PARTITION BY branch_name ORDER BY SUM(quantity) DESC) as rn
      FROM branch_base
      WHERE item_name IS NOT NULL
      GROUP BY branch_name, item_name
    ) ranked
    WHERE rn <= 3
  ),
  branch_categories AS (
    SELECT
      branch_name,
      macro_category,
      COALESCE(SUM(gross_revenue), 0) as cat_revenue
    FROM branch_base
    GROUP BY branch_name, macro_category
  )
  SELECT json_build_object(
    'branches', (
      SELECT json_agg(json_build_object(
        'name', bs.branch_name,
        'revenue', bs.revenue,
        'percentage_of_total', CASE WHEN tr.total > 0 THEN ROUND((bs.revenue::numeric / tr.total * 100), 1) ELSE 0 END,
        'transactions', bs.transactions,
        'avg_ticket', CASE WHEN bs.transactions > 0 THEN bs.revenue / bs.transactions ELSE 0 END,
        'top_items', (
          SELECT COALESCE(json_agg(json_build_object('item', bti.item_name, 'quantity', bti.total_qty) ORDER BY bti.rn), '[]'::json)
          FROM branch_top_items bti
          WHERE bti.branch_name = bs.branch_name
        ),
        'category_breakdown', (
          SELECT COALESCE(json_object_agg(bc.macro_category, bc.cat_revenue), '{}'::json)
          FROM branch_categories bc
          WHERE bc.branch_name = bs.branch_name
        )
      ) ORDER BY bs.revenue DESC)
      FROM branch_summary bs, total_revenue tr
    ),
    'comparison_metrics', (
      SELECT json_build_object(
        'highest_revenue', (SELECT branch_name FROM branch_summary ORDER BY revenue DESC LIMIT 1),
        'lowest_revenue', (SELECT branch_name FROM branch_summary ORDER BY revenue ASC LIMIT 1),
        'revenue_spread', (SELECT MAX(revenue) - MIN(revenue) FROM branch_summary),
        'highest_avg_ticket', (
          SELECT branch_name FROM branch_summary
          WHERE transactions > 0
          ORDER BY revenue / transactions DESC
          LIMIT 1
        )
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_analytics_overview TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_dayparting TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_heatmap TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_categories TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_performance TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_trends TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_branches TO authenticated;
