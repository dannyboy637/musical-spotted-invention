-- Migration: Create aggregation functions for menu analytics
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 005_create_data_import_jobs_table.sql

-- ============================================
-- 1. FUNCTION: AGGREGATE MENU ITEMS
-- ============================================
-- Regenerates menu_items table from transactions for a given tenant.
-- Calculates: totals, averages, time metrics, core/current status, quadrants

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
    GROUP BY t.tenant_id, t.item_name;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Calculate quadrants based on medians (only for core menu items)
    WITH medians AS (
        SELECT
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_quantity) AS median_quantity,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_price) AS median_price
        FROM public.menu_items
        WHERE tenant_id = p_tenant_id AND is_core_menu = TRUE
    )
    UPDATE public.menu_items m
    SET quadrant = CASE
        WHEN m.total_quantity >= med.median_quantity AND m.avg_price >= med.median_price THEN 'Star'
        WHEN m.total_quantity >= med.median_quantity AND m.avg_price < med.median_price THEN 'Plowhorse'
        WHEN m.total_quantity < med.median_quantity AND m.avg_price >= med.median_price THEN 'Puzzle'
        ELSE 'Dog'
    END
    FROM medians med
    WHERE m.tenant_id = p_tenant_id AND m.is_core_menu = TRUE;

    RETURN QUERY SELECT v_count;
END;
$$;

-- ============================================
-- 2. FUNCTION: GET TRANSACTION SUMMARY
-- ============================================
-- Returns summary statistics for transactions with optional filtering.

CREATE OR REPLACE FUNCTION public.get_transaction_summary(
    p_tenant_id UUID DEFAULT NULL,
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL
)
RETURNS TABLE (
    total_transactions BIGINT,
    total_revenue BIGINT,
    unique_items BIGINT,
    unique_receipts BIGINT,
    date_range_start DATE,
    date_range_end DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_transactions,
        COALESCE(SUM(t.gross_revenue), 0)::BIGINT AS total_revenue,
        COUNT(DISTINCT t.item_name)::BIGINT AS unique_items,
        COUNT(DISTINCT t.receipt_number)::BIGINT AS unique_receipts,
        MIN(t.receipt_timestamp::DATE) AS date_range_start,
        MAX(t.receipt_timestamp::DATE) AS date_range_end
    FROM public.transactions t
    WHERE
        (p_tenant_id IS NULL OR t.tenant_id = p_tenant_id)
        AND (p_start_date IS NULL OR t.receipt_timestamp >= p_start_date::TIMESTAMPTZ)
        AND (p_end_date IS NULL OR t.receipt_timestamp <= p_end_date::TIMESTAMPTZ);
END;
$$;

-- ============================================
-- 3. GRANT EXECUTE PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.aggregate_menu_items(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_transaction_summary(UUID, TEXT, TEXT) TO authenticated;
