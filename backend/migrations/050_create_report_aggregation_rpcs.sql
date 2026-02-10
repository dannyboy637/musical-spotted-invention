-- Report Aggregation RPC Functions
-- These functions aggregate data at the database level for report generation,
-- avoiding the Supabase 1000-row default cap on client-side queries.

-- ============================================
-- TOP ITEMS BY REVENUE (for reports)
-- ============================================
CREATE OR REPLACE FUNCTION get_report_top_items(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INT DEFAULT 5
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_data), '[]'::json) INTO result
  FROM (
    SELECT json_build_object(
      'item_name', item_name,
      'category', COALESCE(category, 'Uncategorized'),
      'revenue', COALESCE(SUM(gross_revenue), 0),
      'quantity', COALESCE(SUM(quantity), 0)
    ) as row_data
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND receipt_timestamp::date >= p_start_date
      AND receipt_timestamp::date <= p_end_date
      AND (is_excluded = FALSE OR is_excluded IS NULL)
    GROUP BY item_name, category
    ORDER BY SUM(gross_revenue) DESC
    LIMIT p_limit
  ) t;

  RETURN result;
END;
$$;

-- ============================================
-- MOVERS (GAINERS/DECLINERS) FOR REPORTS
-- ============================================
CREATE OR REPLACE FUNCTION get_report_movers(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_prev_start DATE,
  p_prev_end DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH item_periods AS (
    SELECT
      item_name,
      COALESCE(SUM(CASE
        WHEN receipt_timestamp::date >= p_start_date AND receipt_timestamp::date <= p_end_date
        THEN gross_revenue ELSE 0
      END), 0) as current_revenue,
      COALESCE(SUM(CASE
        WHEN receipt_timestamp::date >= p_prev_start AND receipt_timestamp::date <= p_prev_end
        THEN gross_revenue ELSE 0
      END), 0) as previous_revenue
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND receipt_timestamp::date >= p_prev_start
      AND receipt_timestamp::date <= p_end_date
      AND (is_excluded = FALSE OR is_excluded IS NULL)
    GROUP BY item_name
  ),
  with_changes AS (
    SELECT
      item_name,
      current_revenue,
      previous_revenue,
      current_revenue - previous_revenue as change_amount,
      CASE
        WHEN previous_revenue > 0 THEN ROUND(((current_revenue - previous_revenue)::numeric / previous_revenue * 100), 1)
        WHEN current_revenue > 0 THEN 100.0
        ELSE 0
      END as change_pct
    FROM item_periods
    WHERE current_revenue > 0 OR previous_revenue > 0
  ),
  gainers AS (
    SELECT * FROM with_changes
    WHERE change_pct > 0 AND current_revenue >= 10000
    ORDER BY change_pct DESC
    LIMIT 10
  ),
  decliners AS (
    SELECT * FROM with_changes
    WHERE change_pct < 0 AND previous_revenue >= 10000
    ORDER BY change_pct ASC
    LIMIT 10
  )
  SELECT json_build_object(
    'gainers', COALESCE((
      SELECT json_agg(json_build_object(
        'item_name', item_name,
        'current_revenue', current_revenue,
        'previous_revenue', previous_revenue,
        'change_pct', change_pct,
        'change_amount', change_amount
      ) ORDER BY change_pct DESC)
      FROM gainers
    ), '[]'::json),
    'decliners', COALESCE((
      SELECT json_agg(json_build_object(
        'item_name', item_name,
        'current_revenue', current_revenue,
        'previous_revenue', previous_revenue,
        'change_pct', change_pct,
        'change_amount', change_amount
      ) ORDER BY change_pct ASC)
      FROM decliners
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- CATEGORY BY BRANCH AGGREGATION
-- ============================================
CREATE OR REPLACE FUNCTION get_category_by_branch_agg(
  p_tenant_id UUID,
  p_category TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH branch_totals AS (
    -- Total revenue per branch (all categories) for percentage calculation
    SELECT
      COALESCE(store_name, 'Main') as branch_name,
      COALESCE(SUM(gross_revenue), 0) as total_revenue
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (is_excluded = FALSE OR is_excluded IS NULL)
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
    GROUP BY store_name
  ),
  category_data AS (
    -- Category-specific data per branch
    SELECT
      COALESCE(store_name, 'Main') as branch_name,
      item_name,
      COALESCE(SUM(gross_revenue), 0) as item_revenue,
      COALESCE(SUM(quantity), 0) as item_quantity
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND category = p_category
      AND (is_excluded = FALSE OR is_excluded IS NULL)
      AND (p_start_date IS NULL OR receipt_timestamp::date >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp::date <= p_end_date)
    GROUP BY store_name, item_name
  ),
  branch_cat_agg AS (
    SELECT
      cd.branch_name,
      SUM(cd.item_revenue) as revenue,
      SUM(cd.item_quantity) as quantity,
      COUNT(DISTINCT cd.item_name) as item_count,
      (SELECT cd2.item_name
       FROM category_data cd2
       WHERE cd2.branch_name = cd.branch_name
       ORDER BY cd2.item_revenue DESC
       LIMIT 1) as top_item_name
    FROM category_data cd
    GROUP BY cd.branch_name
  )
  SELECT COALESCE(json_agg(json_build_object(
    'branch', bca.branch_name,
    'revenue', bca.revenue,
    'quantity', bca.quantity,
    'item_count', bca.item_count,
    'top_item', COALESCE(bca.top_item_name, 'N/A'),
    'avg_price', CASE WHEN bca.quantity > 0 THEN ROUND((bca.revenue::numeric / bca.quantity), 2) ELSE 0 END,
    'percentage_of_branch', CASE
      WHEN COALESCE(bt.total_revenue, 0) > 0
      THEN ROUND((bca.revenue::numeric / bt.total_revenue * 100), 1)
      ELSE 0
    END
  ) ORDER BY bca.revenue DESC), '[]'::json) INTO result
  FROM branch_cat_agg bca
  LEFT JOIN branch_totals bt ON bt.branch_name = bca.branch_name;

  RETURN result;
END;
$$;

-- Grant execute only to service_role (backend calls these, not the frontend)
GRANT EXECUTE ON FUNCTION get_report_top_items TO service_role;
GRANT EXECUTE ON FUNCTION get_report_movers TO service_role;
GRANT EXECUTE ON FUNCTION get_category_by_branch_agg TO service_role;
-- Revoke from authenticated to prevent direct PostgREST access
REVOKE EXECUTE ON FUNCTION get_report_top_items FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_report_movers FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_category_by_branch_agg FROM authenticated;
