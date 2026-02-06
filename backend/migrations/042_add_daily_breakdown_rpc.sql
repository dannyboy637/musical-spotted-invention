-- Migration 042: Add daily breakdown RPC for reconciliation

CREATE OR REPLACE FUNCTION get_analytics_daily_breakdown_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  sale_date DATE,
  net_sales BIGINT,
  tax BIGINT,
  service_charge BIGINT,
  discounts BIGINT,
  transactions BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
  SELECT
    (receipt_timestamp AT TIME ZONE 'Asia/Manila')::date AS sale_date,
    (COALESCE(SUM(gross_revenue), 0) - COALESCE(SUM(tax), 0) - COALESCE(SUM(allocated_service_charge), 0))::BIGINT AS net_sales,
    COALESCE(SUM(tax), 0)::BIGINT AS tax,
    COALESCE(SUM(allocated_service_charge), 0)::BIGINT AS service_charge,
    COALESCE(SUM(discount), 0)::BIGINT AS discounts,
    COUNT(DISTINCT receipt_number)::BIGINT AS transactions
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR receipt_timestamp >= p_start_date)
    AND (p_end_date IS NULL OR receipt_timestamp < (p_end_date + INTERVAL '1 day'))
    AND (p_branches IS NULL OR COALESCE(store_name, 'Main') = ANY(p_branches))
    AND (p_categories IS NULL OR category = ANY(p_categories))
    AND (is_excluded = FALSE OR is_excluded IS NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM item_exclusions ie
      WHERE ie.tenant_id = p_tenant_id
        AND ie.item_name = transactions.item_name
    )
  GROUP BY sale_date
  ORDER BY sale_date;
$$;
