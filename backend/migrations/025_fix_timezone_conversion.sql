-- Fix Timezone Conversion Bug
--
-- Problem: Double AT TIME ZONE conversion was causing 8-hour shift in wrong direction
-- Wrong:   receipt_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'
-- Correct: receipt_timestamp AT TIME ZONE 'Asia/Manila'
--
-- This affected get_analytics_dayparting and get_analytics_heatmap functions,
-- causing "Sunday 3am" to show as busiest hour when restaurant is closed.

-- ============================================
-- FIX DAYPARTING FUNCTION
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
        WHEN EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila') >= 6
             AND EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila') < 11 THEN 'breakfast'
        WHEN EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila') >= 11
             AND EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila') < 15 THEN 'lunch'
        WHEN EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila') >= 15
             AND EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila') < 21 THEN 'dinner'
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
-- FIX HEATMAP FUNCTION
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
      EXTRACT(DOW FROM receipt_timestamp AT TIME ZONE 'Asia/Manila')::int as day_of_week,
      EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila')::int as hour_of_day,
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

-- Grant execute permissions (in case they were reset)
GRANT EXECUTE ON FUNCTION get_analytics_dayparting TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_heatmap TO authenticated;
