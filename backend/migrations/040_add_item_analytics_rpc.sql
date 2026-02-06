-- Migration 040: Add item-level analytics RPC functions
-- Provides efficient aggregation for item-based analytics without truncation.

-- ============================================
-- 1. ITEM TOTALS V2 (from transactions)
-- ============================================
CREATE OR REPLACE FUNCTION get_item_totals_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_macro_category TEXT DEFAULT NULL,
  p_core_only BOOLEAN DEFAULT FALSE,
  p_current_only BOOLEAN DEFAULT FALSE,
  p_min_price INTEGER DEFAULT NULL,
  p_max_price INTEGER DEFAULT NULL,
  p_min_quantity INTEGER DEFAULT NULL,
  p_exclude_excluded BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  item_name TEXT,
  category TEXT,
  macro_category TEXT,
  total_quantity BIGINT,
  total_revenue BIGINT,
  avg_price INTEGER,
  order_count BIGINT,
  first_sale_date DATE,
  last_sale_date DATE,
  is_core_menu BOOLEAN,
  is_current_menu BOOLEAN,
  cost_cents INTEGER,
  cost_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT
      t.item_name,
      COALESCE(t.category, 'Uncategorized') AS category,
      COALESCE(t.macro_category, 'OTHER') AS macro_category,
      SUM(t.quantity)::BIGINT AS total_quantity,
      SUM(t.gross_revenue)::BIGINT AS total_revenue,
      COUNT(DISTINCT t.receipt_number)::BIGINT AS order_count,
      MIN(t.receipt_timestamp::DATE) AS first_sale_date,
      MAX(t.receipt_timestamp::DATE) AS last_sale_date
    FROM transactions t
    WHERE t.tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR t.receipt_timestamp >= p_start_date)
      AND (p_end_date IS NULL OR t.receipt_timestamp < (p_end_date + INTERVAL '1 day'))
      AND (p_branches IS NULL OR COALESCE(t.store_name, 'Main') = ANY(p_branches))
      AND (p_categories IS NULL OR t.category = ANY(p_categories))
      AND (
        p_macro_category IS NULL
        OR p_macro_category = 'ALL'
        OR t.macro_category = p_macro_category
      )
      AND (
        p_exclude_excluded = FALSE
        OR t.is_excluded = FALSE
        OR t.is_excluded IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM item_exclusions ie
        WHERE ie.tenant_id = p_tenant_id
          AND ie.item_name = t.item_name
      )
    GROUP BY t.item_name, t.category, t.macro_category
  )
  SELECT
    f.item_name,
    f.category,
    f.macro_category,
    f.total_quantity,
    f.total_revenue,
    CASE
      WHEN f.total_quantity > 0 THEN ROUND(f.total_revenue::numeric / f.total_quantity)::INT
      ELSE 0
    END AS avg_price,
    f.order_count,
    f.first_sale_date,
    f.last_sale_date,
    mi.is_core_menu,
    mi.is_current_menu,
    mi.cost_cents,
    mi.cost_percentage
  FROM filtered f
  LEFT JOIN menu_items mi
    ON mi.tenant_id = p_tenant_id
   AND mi.item_name = f.item_name
  WHERE (p_core_only IS FALSE OR mi.is_core_menu = TRUE)
    AND (p_current_only IS FALSE OR mi.is_current_menu = TRUE)
    AND (
      p_min_price IS NULL
      OR (
        CASE
          WHEN f.total_quantity > 0 THEN ROUND(f.total_revenue::numeric / f.total_quantity)::INT
          ELSE 0
        END
      ) >= p_min_price
    )
    AND (
      p_max_price IS NULL
      OR (
        CASE
          WHEN f.total_quantity > 0 THEN ROUND(f.total_revenue::numeric / f.total_quantity)::INT
          ELSE 0
        END
      ) <= p_max_price
    )
    AND (p_min_quantity IS NULL OR f.total_quantity >= p_min_quantity)
  ORDER BY f.total_revenue DESC;
END;
$$;

-- ============================================
-- 2. UNIQUE ITEM COUNT V2 (from transactions)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_unique_items_v2(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
  SELECT COUNT(DISTINCT t.item_name)::BIGINT
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR t.receipt_timestamp >= p_start_date)
    AND (p_end_date IS NULL OR t.receipt_timestamp < (p_end_date + INTERVAL '1 day'))
    AND (p_branches IS NULL OR COALESCE(t.store_name, 'Main') = ANY(p_branches))
    AND (p_categories IS NULL OR t.category = ANY(p_categories))
    AND (t.is_excluded = FALSE OR t.is_excluded IS NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM item_exclusions ie
      WHERE ie.tenant_id = p_tenant_id
        AND ie.item_name = t.item_name
    );
$$;

-- ============================================
-- 3. CATEGORY BY BRANCH V2 (from transactions)
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_category_by_branch_v2(
  p_tenant_id UUID,
  p_category TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSON;
BEGIN
  WITH filtered AS (
    SELECT
      COALESCE(store_name, 'Main') AS store_name,
      item_name,
      gross_revenue,
      quantity
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND category = p_category
      AND (p_start_date IS NULL OR receipt_timestamp >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp < (p_end_date + INTERVAL '1 day'))
      AND (is_excluded = FALSE OR is_excluded IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM item_exclusions ie
        WHERE ie.tenant_id = p_tenant_id
          AND ie.item_name = transactions.item_name
      )
  ),
  branch_totals AS (
    SELECT
      store_name,
      SUM(gross_revenue) AS revenue,
      SUM(quantity) AS quantity,
      COUNT(DISTINCT item_name) AS item_count
    FROM filtered
    GROUP BY store_name
  ),
  branch_top_items AS (
    SELECT
      store_name,
      item_name,
      SUM(gross_revenue) AS item_revenue,
      ROW_NUMBER() OVER (PARTITION BY store_name ORDER BY SUM(gross_revenue) DESC) AS rn
    FROM filtered
    GROUP BY store_name, item_name
  ),
  branch_revenue_all AS (
    SELECT
      COALESCE(store_name, 'Main') AS store_name,
      SUM(gross_revenue) AS total_revenue
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR receipt_timestamp >= p_start_date)
      AND (p_end_date IS NULL OR receipt_timestamp < (p_end_date + INTERVAL '1 day'))
      AND (is_excluded = FALSE OR is_excluded IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM item_exclusions ie
        WHERE ie.tenant_id = p_tenant_id
          AND ie.item_name = transactions.item_name
      )
    GROUP BY COALESCE(store_name, 'Main')
  )
  SELECT json_build_object(
    'branches', COALESCE((
      SELECT json_agg(
        json_build_object(
          'branch', bt.store_name,
          'revenue', bt.revenue,
          'quantity', bt.quantity,
          'item_count', bt.item_count,
          'top_item', bti.item_name,
          'total_branch_revenue', br.total_revenue
        )
        ORDER BY bt.revenue DESC
      )
      FROM branch_totals bt
      LEFT JOIN branch_top_items bti
        ON bti.store_name = bt.store_name
       AND bti.rn = 1
      LEFT JOIN branch_revenue_all br
        ON br.store_name = bt.store_name
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;
