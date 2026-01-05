-- Migration: Fix quadrant calculation for ALL non-excluded items
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this to fix menu engineering display issues
--
-- PROBLEM: The original aggregate_menu_items function only calculated quadrants
-- for items where is_core_menu = TRUE. This means newer items or items with
-- less than 6 months of history never got a quadrant assigned, causing them
-- to not display in the Menu Engineering page.
--
-- FIX: Calculate quadrants for ALL non-excluded items (is_excluded = FALSE)

-- ============================================
-- 1. REPLACE AGGREGATE_MENU_ITEMS FUNCTION
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
    GROUP BY t.tenant_id, t.item_name;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- FIXED: Calculate quadrants for ALL non-excluded items (not just core menu)
    -- This ensures all items that should be displayed have a quadrant assigned
    WITH medians AS (
        SELECT
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_quantity) AS median_quantity,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_price) AS median_price
        FROM public.menu_items
        WHERE tenant_id = p_tenant_id AND is_excluded = FALSE  -- Changed from is_core_menu = TRUE
    )
    UPDATE public.menu_items m
    SET quadrant = CASE
        WHEN m.total_quantity >= med.median_quantity AND m.avg_price >= med.median_price THEN 'Star'
        WHEN m.total_quantity >= med.median_quantity AND m.avg_price < med.median_price THEN 'Plowhorse'
        WHEN m.total_quantity < med.median_quantity AND m.avg_price >= med.median_price THEN 'Puzzle'
        ELSE 'Dog'
    END
    FROM medians med
    WHERE m.tenant_id = p_tenant_id AND m.is_excluded = FALSE;  -- Changed from is_core_menu = TRUE

    RETURN QUERY SELECT v_count;
END;
$$;

-- ============================================
-- 2. VERIFY PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.aggregate_menu_items(UUID) TO authenticated;

-- ============================================
-- 3. INSTRUCTIONS AFTER RUNNING THIS MIGRATION
-- ============================================
-- After running this migration, you need to regenerate menu items:
--
-- Option 1: Via API
--   POST /data/menu-items/regenerate
--
-- Option 2: Via SQL
--   SELECT * FROM aggregate_menu_items('your-tenant-uuid-here');
--
-- This will recalculate all menu items with proper quadrants.
