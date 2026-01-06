-- Migration 034: Create refresh functions for summary tables
--
-- These functions rebuild summary tables from raw transactions.
-- Called after each import to ensure dashboard data is up-to-date.
--
-- Expected refresh time: 30-60 seconds for large tenant (~600k rows)

-- ============================================
-- 1. REFRESH HOURLY SUMMARIES
-- ============================================
CREATE OR REPLACE FUNCTION refresh_hourly_summaries(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
  rows_deleted INT;
  rows_inserted INT;
BEGIN
  -- Delete existing summaries for this tenant
  DELETE FROM hourly_summaries WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  -- Insert new summaries grouped by all dimensions
  INSERT INTO hourly_summaries (
    tenant_id,
    sale_date,
    local_hour,
    day_of_week,
    store_name,
    category,
    macro_category,
    revenue,
    quantity,
    transaction_count
  )
  SELECT
    p_tenant_id,
    (receipt_timestamp AT TIME ZONE 'Asia/Manila')::date as sale_date,
    EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila')::int as local_hour,
    EXTRACT(DOW FROM receipt_timestamp AT TIME ZONE 'Asia/Manila')::int as day_of_week,
    COALESCE(store_name, 'Main') as store_name,
    COALESCE(category, 'Uncategorized') as category,
    COALESCE(macro_category, 'OTHER') as macro_category,
    COALESCE(SUM(gross_revenue), 0) as revenue,
    COALESCE(SUM(quantity), 0) as quantity,
    COUNT(*) as transaction_count
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND (is_excluded = false OR is_excluded IS NULL)
  GROUP BY
    (receipt_timestamp AT TIME ZONE 'Asia/Manila')::date,
    EXTRACT(HOUR FROM receipt_timestamp AT TIME ZONE 'Asia/Manila'),
    EXTRACT(DOW FROM receipt_timestamp AT TIME ZONE 'Asia/Manila'),
    COALESCE(store_name, 'Main'),
    COALESCE(category, 'Uncategorized'),
    COALESCE(macro_category, 'OTHER');

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'rows_deleted', rows_deleted,
    'rows_inserted', rows_inserted
  );
END;
$$;

-- ============================================
-- 2. REFRESH ITEM PAIRS (Bundle Analysis)
-- ============================================
CREATE OR REPLACE FUNCTION refresh_item_pairs(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,  -- NULL = 90 days ago
  p_end_date DATE DEFAULT NULL,    -- NULL = today
  p_limit INT DEFAULT 500          -- Top N pairs to store
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '180s'  -- Longer timeout for self-join
AS $$
DECLARE
  rows_deleted INT;
  rows_inserted INT;
  v_start_date DATE;
  v_end_date DATE;
  v_total_receipts INT;
BEGIN
  -- Default to last 90 days
  v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '90 days');
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);

  -- Delete existing pairs for this tenant
  DELETE FROM item_pairs WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  -- Get total receipts for support calculation
  SELECT COUNT(DISTINCT receipt_number) INTO v_total_receipts
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND receipt_timestamp >= v_start_date::timestamptz
    AND receipt_timestamp < (v_end_date + 1)::timestamptz
    AND (is_excluded = false OR is_excluded IS NULL);

  -- Insert new pairs from self-join analysis
  WITH receipt_items AS (
    -- Get unique items per receipt (deduplicated)
    SELECT DISTINCT
      receipt_number,
      item_name
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (is_excluded = false OR is_excluded IS NULL)
      AND item_name IS NOT NULL
      AND receipt_number IS NOT NULL
      AND receipt_timestamp >= v_start_date::timestamptz
      AND receipt_timestamp < (v_end_date + 1)::timestamptz
  ),
  pairs AS (
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
    HAVING COUNT(DISTINCT a.receipt_number) >= 2  -- At least 2 occurrences
    ORDER BY frequency DESC
    LIMIT p_limit
  )
  INSERT INTO item_pairs (
    tenant_id,
    item_a,
    item_b,
    frequency,
    support,
    analysis_start,
    analysis_end
  )
  SELECT
    p_tenant_id,
    item_a,
    item_b,
    frequency,
    CASE WHEN v_total_receipts > 0
         THEN ROUND((frequency::numeric / v_total_receipts), 4)
         ELSE 0 END as support,
    v_start_date,
    v_end_date
  FROM pairs;

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'rows_deleted', rows_deleted,
    'rows_inserted', rows_inserted,
    'analysis_start', v_start_date,
    'analysis_end', v_end_date,
    'total_receipts', v_total_receipts
  );
END;
$$;

-- ============================================
-- 3. REFRESH BRANCH SUMMARIES
-- ============================================
CREATE OR REPLACE FUNCTION refresh_branch_summaries(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
  rows_deleted INT;
  rows_inserted INT;
BEGIN
  -- Delete existing summaries for this tenant
  DELETE FROM branch_summaries WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  -- ============================================
  -- DAILY SUMMARIES
  -- ============================================
  INSERT INTO branch_summaries (
    tenant_id,
    period_type,
    period_start,
    store_name,
    revenue,
    transaction_count,
    receipt_count,
    avg_ticket,
    top_items,
    category_breakdown
  )
  WITH daily_base AS (
    SELECT
      (receipt_timestamp AT TIME ZONE 'Asia/Manila')::date as period_start,
      COALESCE(store_name, 'Main') as store_name,
      gross_revenue,
      quantity,
      receipt_number,
      item_name,
      category
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (is_excluded = false OR is_excluded IS NULL)
  ),
  daily_metrics AS (
    SELECT
      period_start,
      store_name,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(*) as transaction_count,
      COUNT(DISTINCT receipt_number) as receipt_count
    FROM daily_base
    GROUP BY period_start, store_name
  ),
  daily_top_items AS (
    SELECT
      period_start,
      store_name,
      jsonb_agg(
        jsonb_build_object('item_name', item_name, 'quantity', total_qty, 'revenue', total_rev)
        ORDER BY total_qty DESC
      ) FILTER (WHERE rn <= 10) as top_items
    FROM (
      SELECT
        period_start,
        store_name,
        item_name,
        SUM(quantity) as total_qty,
        SUM(gross_revenue) as total_rev,
        ROW_NUMBER() OVER (PARTITION BY period_start, store_name ORDER BY SUM(quantity) DESC) as rn
      FROM daily_base
      WHERE item_name IS NOT NULL
      GROUP BY period_start, store_name, item_name
    ) ranked
    GROUP BY period_start, store_name
  ),
  daily_categories AS (
    SELECT
      period_start,
      store_name,
      jsonb_object_agg(
        category,
        jsonb_build_object('revenue', cat_revenue, 'quantity', cat_quantity)
      ) as category_breakdown
    FROM (
      SELECT
        period_start,
        store_name,
        COALESCE(category, 'Uncategorized') as category,
        SUM(gross_revenue) as cat_revenue,
        SUM(quantity) as cat_quantity
      FROM daily_base
      GROUP BY period_start, store_name, COALESCE(category, 'Uncategorized')
    ) cat_agg
    GROUP BY period_start, store_name
  )
  SELECT
    p_tenant_id,
    'daily'::text,
    m.period_start,
    m.store_name,
    m.revenue,
    m.transaction_count,
    m.receipt_count,
    CASE WHEN m.receipt_count > 0 THEN m.revenue / m.receipt_count ELSE 0 END as avg_ticket,
    COALESCE(t.top_items, '[]'::jsonb),
    COALESCE(c.category_breakdown, '{}'::jsonb)
  FROM daily_metrics m
  LEFT JOIN daily_top_items t ON m.period_start = t.period_start AND m.store_name = t.store_name
  LEFT JOIN daily_categories c ON m.period_start = c.period_start AND m.store_name = c.store_name;

  -- ============================================
  -- WEEKLY SUMMARIES
  -- ============================================
  INSERT INTO branch_summaries (
    tenant_id,
    period_type,
    period_start,
    store_name,
    revenue,
    transaction_count,
    receipt_count,
    avg_ticket,
    top_items,
    category_breakdown
  )
  WITH weekly_base AS (
    SELECT
      DATE_TRUNC('week', (receipt_timestamp AT TIME ZONE 'Asia/Manila')::date)::date as period_start,
      COALESCE(store_name, 'Main') as store_name,
      gross_revenue,
      quantity,
      receipt_number,
      item_name,
      category
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (is_excluded = false OR is_excluded IS NULL)
  ),
  weekly_metrics AS (
    SELECT
      period_start,
      store_name,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(*) as transaction_count,
      COUNT(DISTINCT receipt_number) as receipt_count
    FROM weekly_base
    GROUP BY period_start, store_name
  ),
  weekly_top_items AS (
    SELECT
      period_start,
      store_name,
      jsonb_agg(
        jsonb_build_object('item_name', item_name, 'quantity', total_qty, 'revenue', total_rev)
        ORDER BY total_qty DESC
      ) FILTER (WHERE rn <= 10) as top_items
    FROM (
      SELECT
        period_start,
        store_name,
        item_name,
        SUM(quantity) as total_qty,
        SUM(gross_revenue) as total_rev,
        ROW_NUMBER() OVER (PARTITION BY period_start, store_name ORDER BY SUM(quantity) DESC) as rn
      FROM weekly_base
      WHERE item_name IS NOT NULL
      GROUP BY period_start, store_name, item_name
    ) ranked
    GROUP BY period_start, store_name
  ),
  weekly_categories AS (
    SELECT
      period_start,
      store_name,
      jsonb_object_agg(
        category,
        jsonb_build_object('revenue', cat_revenue, 'quantity', cat_quantity)
      ) as category_breakdown
    FROM (
      SELECT
        period_start,
        store_name,
        COALESCE(category, 'Uncategorized') as category,
        SUM(gross_revenue) as cat_revenue,
        SUM(quantity) as cat_quantity
      FROM weekly_base
      GROUP BY period_start, store_name, COALESCE(category, 'Uncategorized')
    ) cat_agg
    GROUP BY period_start, store_name
  )
  SELECT
    p_tenant_id,
    'weekly'::text,
    m.period_start,
    m.store_name,
    m.revenue,
    m.transaction_count,
    m.receipt_count,
    CASE WHEN m.receipt_count > 0 THEN m.revenue / m.receipt_count ELSE 0 END as avg_ticket,
    COALESCE(t.top_items, '[]'::jsonb),
    COALESCE(c.category_breakdown, '{}'::jsonb)
  FROM weekly_metrics m
  LEFT JOIN weekly_top_items t ON m.period_start = t.period_start AND m.store_name = t.store_name
  LEFT JOIN weekly_categories c ON m.period_start = c.period_start AND m.store_name = c.store_name;

  -- ============================================
  -- MONTHLY SUMMARIES
  -- ============================================
  INSERT INTO branch_summaries (
    tenant_id,
    period_type,
    period_start,
    store_name,
    revenue,
    transaction_count,
    receipt_count,
    avg_ticket,
    top_items,
    category_breakdown
  )
  WITH monthly_base AS (
    SELECT
      DATE_TRUNC('month', (receipt_timestamp AT TIME ZONE 'Asia/Manila')::date)::date as period_start,
      COALESCE(store_name, 'Main') as store_name,
      gross_revenue,
      quantity,
      receipt_number,
      item_name,
      category
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND (is_excluded = false OR is_excluded IS NULL)
  ),
  monthly_metrics AS (
    SELECT
      period_start,
      store_name,
      COALESCE(SUM(gross_revenue), 0) as revenue,
      COUNT(*) as transaction_count,
      COUNT(DISTINCT receipt_number) as receipt_count
    FROM monthly_base
    GROUP BY period_start, store_name
  ),
  monthly_top_items AS (
    SELECT
      period_start,
      store_name,
      jsonb_agg(
        jsonb_build_object('item_name', item_name, 'quantity', total_qty, 'revenue', total_rev)
        ORDER BY total_qty DESC
      ) FILTER (WHERE rn <= 10) as top_items
    FROM (
      SELECT
        period_start,
        store_name,
        item_name,
        SUM(quantity) as total_qty,
        SUM(gross_revenue) as total_rev,
        ROW_NUMBER() OVER (PARTITION BY period_start, store_name ORDER BY SUM(quantity) DESC) as rn
      FROM monthly_base
      WHERE item_name IS NOT NULL
      GROUP BY period_start, store_name, item_name
    ) ranked
    GROUP BY period_start, store_name
  ),
  monthly_categories AS (
    SELECT
      period_start,
      store_name,
      jsonb_object_agg(
        category,
        jsonb_build_object('revenue', cat_revenue, 'quantity', cat_quantity)
      ) as category_breakdown
    FROM (
      SELECT
        period_start,
        store_name,
        COALESCE(category, 'Uncategorized') as category,
        SUM(gross_revenue) as cat_revenue,
        SUM(quantity) as cat_quantity
      FROM monthly_base
      GROUP BY period_start, store_name, COALESCE(category, 'Uncategorized')
    ) cat_agg
    GROUP BY period_start, store_name
  )
  SELECT
    p_tenant_id,
    'monthly'::text,
    m.period_start,
    m.store_name,
    m.revenue,
    m.transaction_count,
    m.receipt_count,
    CASE WHEN m.receipt_count > 0 THEN m.revenue / m.receipt_count ELSE 0 END as avg_ticket,
    COALESCE(t.top_items, '[]'::jsonb),
    COALESCE(c.category_breakdown, '{}'::jsonb)
  FROM monthly_metrics m
  LEFT JOIN monthly_top_items t ON m.period_start = t.period_start AND m.store_name = t.store_name
  LEFT JOIN monthly_categories c ON m.period_start = c.period_start AND m.store_name = c.store_name;

  -- Get total rows inserted
  SELECT COUNT(*) INTO rows_inserted FROM branch_summaries WHERE tenant_id = p_tenant_id;

  RETURN json_build_object(
    'success', true,
    'rows_deleted', rows_deleted,
    'rows_inserted', rows_inserted
  );
END;
$$;

-- ============================================
-- 4. MASTER REFRESH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION refresh_all_summaries(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'  -- 5 minutes for full refresh
AS $$
DECLARE
  hourly_result JSON;
  pairs_result JSON;
  branch_result JSON;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  start_time := clock_timestamp();

  -- Refresh all summary tables
  hourly_result := refresh_hourly_summaries(p_tenant_id);
  pairs_result := refresh_item_pairs(p_tenant_id);
  branch_result := refresh_branch_summaries(p_tenant_id);

  end_time := clock_timestamp();

  RETURN json_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'hourly_summaries', hourly_result,
    'item_pairs', pairs_result,
    'branch_summaries', branch_result,
    'duration_ms', EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
  );
END;
$$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION refresh_hourly_summaries IS 'Rebuild hourly_summaries table from transactions for a tenant';
COMMENT ON FUNCTION refresh_item_pairs IS 'Rebuild item_pairs table with bundle analysis (default: last 90 days)';
COMMENT ON FUNCTION refresh_branch_summaries IS 'Rebuild branch_summaries table with daily/weekly/monthly rollups';
COMMENT ON FUNCTION refresh_all_summaries IS 'Master function to refresh all summary tables for a tenant';
