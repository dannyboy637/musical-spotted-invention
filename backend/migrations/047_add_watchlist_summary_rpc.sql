-- Migration 047: Add watched items summary RPC

CREATE OR REPLACE FUNCTION public.get_watched_items_summary_v1(
  p_tenant_id UUID,
  p_item_names TEXT[],
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  item_name TEXT,
  total_quantity BIGINT,
  total_revenue BIGINT,
  order_count BIGINT,
  first_sale_date DATE,
  last_sale_date DATE,
  avg_price INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.item_name,
    SUM(t.quantity)::BIGINT AS total_quantity,
    SUM(t.gross_revenue)::BIGINT AS total_revenue,
    COUNT(DISTINCT t.receipt_number)::BIGINT AS order_count,
    MIN(t.receipt_timestamp::DATE) AS first_sale_date,
    MAX(t.receipt_timestamp::DATE) AS last_sale_date,
    CASE
      WHEN SUM(t.quantity) > 0
        THEN ROUND(SUM(t.gross_revenue)::numeric / SUM(t.quantity))::INT
      ELSE 0
    END AS avg_price
  FROM public.transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.item_name IS NOT NULL
    AND (p_item_names IS NULL OR t.item_name = ANY(p_item_names))
    AND (p_start_date IS NULL OR t.receipt_timestamp >= p_start_date)
    AND (p_end_date IS NULL OR t.receipt_timestamp < (p_end_date + INTERVAL '1 day'))
    AND (p_branches IS NULL OR COALESCE(t.store_name, 'Main') = ANY(p_branches))
    AND (p_categories IS NULL OR t.category = ANY(p_categories))
  GROUP BY t.item_name
  ORDER BY total_revenue DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_watched_items_summary_v1(UUID, TEXT[], DATE, DATE, TEXT[], TEXT[]) TO authenticated;
