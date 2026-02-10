-- Migration 044: Apply item_exclusions filters to refresh functions and add suggestions RPC

-- ============================================
-- 1. REFRESH HOURLY SUMMARIES (exclude item_exclusions)
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
    (t.receipt_timestamp AT TIME ZONE 'Asia/Manila')::date as sale_date,
    EXTRACT(HOUR FROM t.receipt_timestamp AT TIME ZONE 'Asia/Manila')::int as local_hour,
    EXTRACT(DOW FROM t.receipt_timestamp AT TIME ZONE 'Asia/Manila')::int as day_of_week,
    COALESCE(t.store_name, 'Main') as store_name,
    COALESCE(t.category, 'Uncategorized') as category,
    COALESCE(t.macro_category, 'OTHER') as macro_category,
    COALESCE(SUM(t.gross_revenue), 0) as revenue,
    COALESCE(SUM(t.quantity), 0) as quantity,
    COUNT(*) as transaction_count
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND (t.is_excluded = false OR t.is_excluded IS NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM item_exclusions ie
      WHERE ie.tenant_id = p_tenant_id
        AND ie.item_name = t.item_name
    )
  GROUP BY
    (t.receipt_timestamp AT TIME ZONE 'Asia/Manila')::date,
    EXTRACT(HOUR FROM t.receipt_timestamp AT TIME ZONE 'Asia/Manila'),
    EXTRACT(DOW FROM t.receipt_timestamp AT TIME ZONE 'Asia/Manila'),
    COALESCE(t.store_name, 'Main'),
    COALESCE(t.category, 'Uncategorized'),
    COALESCE(t.macro_category, 'OTHER');

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'rows_deleted', rows_deleted,
    'rows_inserted', rows_inserted
  );
END;
$$;

-- ============================================
-- 2. REFRESH ITEM PAIRS (exclude item_exclusions)
-- ============================================
CREATE OR REPLACE FUNCTION refresh_item_pairs(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INT DEFAULT 500
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '180s'
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
  SELECT COUNT(DISTINCT t.receipt_number) INTO v_total_receipts
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.receipt_timestamp >= v_start_date::timestamptz
    AND t.receipt_timestamp < (v_end_date + 1)::timestamptz
    AND (t.is_excluded = false OR t.is_excluded IS NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM item_exclusions ie
      WHERE ie.tenant_id = p_tenant_id
        AND ie.item_name = t.item_name
    );

  -- Insert new pairs from self-join analysis
  WITH receipt_items AS (
    -- Get unique items per receipt (deduplicated)
    SELECT DISTINCT
      t.receipt_number,
      t.item_name
    FROM transactions t
    WHERE t.tenant_id = p_tenant_id
      AND (t.is_excluded = false OR t.is_excluded IS NULL)
      AND t.item_name IS NOT NULL
      AND t.receipt_number IS NOT NULL
      AND t.receipt_timestamp >= v_start_date::timestamptz
      AND t.receipt_timestamp < (v_end_date + 1)::timestamptz
      AND NOT EXISTS (
        SELECT 1
        FROM item_exclusions ie
        WHERE ie.tenant_id = p_tenant_id
          AND ie.item_name = t.item_name
      )
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
    HAVING COUNT(DISTINCT a.receipt_number) >= 2
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
-- 3. REFRESH BRANCH SUMMARIES (exclude item_exclusions)
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
      (t.receipt_timestamp AT TIME ZONE 'Asia/Manila')::date as period_start,
      COALESCE(t.store_name, 'Main') as store_name,
      t.gross_revenue,
      t.quantity,
      t.receipt_number,
      t.item_name,
      t.category
    FROM transactions t
    WHERE t.tenant_id = p_tenant_id
      AND (t.is_excluded = false OR t.is_excluded IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM item_exclusions ie
        WHERE ie.tenant_id = p_tenant_id
          AND ie.item_name = t.item_name
      )
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
      DATE_TRUNC('week', (t.receipt_timestamp AT TIME ZONE 'Asia/Manila')::date)::date as period_start,
      COALESCE(t.store_name, 'Main') as store_name,
      t.gross_revenue,
      t.quantity,
      t.receipt_number,
      t.item_name,
      t.category
    FROM transactions t
    WHERE t.tenant_id = p_tenant_id
      AND (t.is_excluded = false OR t.is_excluded IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM item_exclusions ie
        WHERE ie.tenant_id = p_tenant_id
          AND ie.item_name = t.item_name
      )
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
      DATE_TRUNC('month', (t.receipt_timestamp AT TIME ZONE 'Asia/Manila')::date)::date as period_start,
      COALESCE(t.store_name, 'Main') as store_name,
      t.gross_revenue,
      t.quantity,
      t.receipt_number,
      t.item_name,
      t.category
    FROM transactions t
    WHERE t.tenant_id = p_tenant_id
      AND (t.is_excluded = false OR t.is_excluded IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM item_exclusions ie
        WHERE ie.tenant_id = p_tenant_id
          AND ie.item_name = t.item_name
      )
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
-- 4. AGGREGATE MENU ITEMS (exclude item_exclusions)
-- ============================================
CREATE OR REPLACE FUNCTION public.aggregate_menu_items(p_tenant_id UUID)
RETURNS TABLE (
    items_updated INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT := 0;
    v_now TIMESTAMPTZ := NOW();
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Delete existing menu items for tenant (full refresh)
    DELETE FROM public.menu_items WHERE tenant_id = p_tenant_id;

    -- Insert aggregated data from transactions
    INSERT INTO public.menu_items (
        tenant_id,
        item_name,
        category,
        macro_category,
        total_quantity,
        total_gross_revenue,
        avg_price,
        order_count,
        first_sale_date,
        last_sale_date,
        months_active,
        days_since_last_sale,
        is_core_menu,
        is_current_menu,
        is_excluded,
        last_aggregated_at
    )
    SELECT
        t.tenant_id,
        t.item_name,
        MAX(t.category),
        MAX(t.macro_category),
        SUM(t.quantity)::INT,
        SUM(t.gross_revenue)::INT,
        (AVG(t.unit_price))::INT,
        COUNT(DISTINCT t.receipt_number)::INT,
        MIN(t.receipt_timestamp::DATE),
        MAX(t.receipt_timestamp::DATE),
        -- months_active: at least 1 month
        GREATEST(1, (EXTRACT(YEAR FROM AGE(MAX(t.receipt_timestamp), MIN(t.receipt_timestamp))) * 12
                   + EXTRACT(MONTH FROM AGE(MAX(t.receipt_timestamp), MIN(t.receipt_timestamp)))))::INT,
        -- days_since_last_sale
        (v_today - MAX(t.receipt_timestamp::DATE))::INT,
        -- is_core_menu: not excluded AND active 6+ months
        (NOT BOOL_OR(t.is_excluded)) AND
            (GREATEST(1, (EXTRACT(YEAR FROM AGE(MAX(t.receipt_timestamp), MIN(t.receipt_timestamp))) * 12
                       + EXTRACT(MONTH FROM AGE(MAX(t.receipt_timestamp), MIN(t.receipt_timestamp))))) >= 6),
        -- is_current_menu: sold in last 30 days
        ((v_today - MAX(t.receipt_timestamp::DATE)) <= 30),
        BOOL_OR(t.is_excluded),
        v_now
    FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.item_exclusions ie
        WHERE ie.tenant_id = p_tenant_id
          AND ie.item_name = t.item_name
      )
    GROUP BY t.tenant_id, t.item_name;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Calculate quadrants for ALL non-excluded items
    WITH medians AS (
        SELECT
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_quantity) AS median_quantity,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_price) AS median_price
        FROM public.menu_items
        WHERE tenant_id = p_tenant_id AND is_excluded = FALSE
    )
    UPDATE public.menu_items m
    SET quadrant = CASE
        WHEN m.total_quantity >= med.median_quantity AND m.avg_price >= med.median_price THEN 'Star'
        WHEN m.total_quantity >= med.median_quantity AND m.avg_price < med.median_price THEN 'Plowhorse'
        WHEN m.total_quantity < med.median_quantity AND m.avg_price >= med.median_price THEN 'Puzzle'
        ELSE 'Dog'
    END
    FROM medians med
    WHERE m.tenant_id = p_tenant_id AND m.is_excluded = FALSE;

    RETURN QUERY SELECT v_count;
END;
$$;

-- ============================================
-- 5. ITEM EXCLUSION SUGGESTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.get_item_exclusion_suggestions(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_max_quantity INT DEFAULT 2,
  p_max_revenue BIGINT DEFAULT 1000,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  item_name TEXT,
  total_quantity BIGINT,
  total_revenue BIGINT,
  order_count BIGINT,
  first_sale_date DATE,
  last_sale_date DATE
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
    MAX(t.receipt_timestamp::DATE) AS last_sale_date
  FROM public.transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.item_name IS NOT NULL
    AND (p_start_date IS NULL OR t.receipt_timestamp >= p_start_date)
    AND (p_end_date IS NULL OR t.receipt_timestamp < (p_end_date + INTERVAL '1 day'))
    AND (p_branches IS NULL OR COALESCE(t.store_name, 'Main') = ANY(p_branches))
    AND (p_categories IS NULL OR t.category = ANY(p_categories))
    AND (t.is_excluded = FALSE OR t.is_excluded IS NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM public.item_exclusions ie
      WHERE ie.tenant_id = p_tenant_id
        AND ie.item_name = t.item_name
    )
  GROUP BY t.item_name
  HAVING (
      p_max_quantity IS NULL
      OR SUM(t.quantity) <= p_max_quantity
    )
    OR (
      p_max_revenue IS NULL
      OR SUM(t.gross_revenue) <= p_max_revenue
    )
  ORDER BY SUM(t.gross_revenue) ASC, SUM(t.quantity) ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_item_exclusion_suggestions(UUID, DATE, DATE, TEXT[], TEXT[], INT, BIGINT, INT) TO authenticated;
