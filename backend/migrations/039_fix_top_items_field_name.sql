-- Migration 039: Fix top_items field name mismatch
--
-- The branch_summaries table stores top_items with 'item_name' field,
-- but the frontend expects 'item'. This migration updates the
-- get_analytics_branches_v2 function to transform the field name.

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
      -- Transform item_name to item for frontend compatibility
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'item', elem->>'item_name',
            'quantity', (elem->>'quantity')::int
          )
        )
        FROM jsonb_array_elements(top_items) AS elem
      ) as top_items
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

COMMENT ON FUNCTION get_analytics_branches_v2 IS 'Branch comparison from branch_summaries (fast) - transforms item_name to item for frontend';
