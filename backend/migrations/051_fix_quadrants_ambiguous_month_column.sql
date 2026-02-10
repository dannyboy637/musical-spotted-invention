-- Migration 051: Fix "column reference 'month' is ambiguous" in get_item_monthly_quadrants_v1
-- The RETURNS TABLE (month TEXT, ...) creates a PL/pgSQL variable that clashes
-- with the 'month' column alias in the CTEs. Fix by using distinct aliases.

CREATE OR REPLACE FUNCTION public.get_item_monthly_quadrants_v1(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_item_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  month TEXT,
  item_name TEXT,
  total_quantity BIGINT,
  total_revenue BIGINT,
  avg_price INTEGER,
  order_count BIGINT,
  quadrant TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := COALESCE(p_start_date, (CURRENT_DATE - INTERVAL '12 months')::date);
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', (t.receipt_timestamp AT TIME ZONE 'Asia/Manila')), 'YYYY-MM') AS m,
      t.item_name AS t_item_name,
      SUM(t.quantity)::BIGINT AS t_total_quantity,
      SUM(t.gross_revenue)::BIGINT AS t_total_revenue,
      COUNT(DISTINCT t.receipt_number)::BIGINT AS t_order_count,
      CASE
        WHEN SUM(t.quantity) > 0
          THEN ROUND(SUM(t.gross_revenue)::numeric / SUM(t.quantity))::INT
        ELSE 0
      END AS t_avg_price
    FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id
      AND t.item_name IS NOT NULL
      AND t.receipt_timestamp >= v_start_date
      AND t.receipt_timestamp < (v_end_date + INTERVAL '1 day')
      AND (p_branches IS NULL OR COALESCE(t.store_name, 'Main') = ANY(p_branches))
      AND (p_categories IS NULL OR t.category = ANY(p_categories))
      AND (t.is_excluded = FALSE OR t.is_excluded IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM public.item_exclusions ie
        WHERE ie.tenant_id = p_tenant_id
          AND ie.item_name = t.item_name
      )
      AND (p_item_name IS NULL OR t.item_name = p_item_name)
    GROUP BY 1, t.item_name
  ),
  medians AS (
    SELECT
      filtered.m,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY filtered.t_total_quantity) AS median_quantity,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY filtered.t_avg_price) AS median_price
    FROM filtered
    GROUP BY filtered.m
  )
  SELECT
    f.m,
    f.t_item_name,
    f.t_total_quantity,
    f.t_total_revenue,
    f.t_avg_price,
    f.t_order_count,
    CASE
      WHEN f.t_total_quantity >= md.median_quantity AND f.t_avg_price >= md.median_price THEN 'Star'
      WHEN f.t_total_quantity >= md.median_quantity AND f.t_avg_price < md.median_price THEN 'Plowhorse'
      WHEN f.t_total_quantity < md.median_quantity AND f.t_avg_price >= md.median_price THEN 'Puzzle'
      ELSE 'Dog'
    END AS quadrant
  FROM filtered f
  JOIN medians md ON md.m = f.m
  ORDER BY f.m DESC, f.t_total_revenue DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_item_monthly_quadrants_v1(UUID, DATE, DATE, TEXT[], TEXT[], TEXT) TO authenticated;
