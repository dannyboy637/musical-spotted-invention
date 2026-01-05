-- Migration: Create efficient functions for filter options
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. GET DISTINCT STORE NAMES
-- ============================================

CREATE OR REPLACE FUNCTION get_distinct_store_names(p_tenant_id UUID)
RETURNS TABLE(store_name TEXT)
LANGUAGE sql
STABLE
AS $$
    SELECT DISTINCT t.store_name
    FROM transactions t
    WHERE t.tenant_id = p_tenant_id
      AND t.store_name IS NOT NULL
    ORDER BY t.store_name;
$$;

-- ============================================
-- 2. GET DISTINCT CATEGORIES
-- ============================================

CREATE OR REPLACE FUNCTION get_distinct_categories(p_tenant_id UUID)
RETURNS TABLE(category TEXT)
LANGUAGE sql
STABLE
AS $$
    SELECT DISTINCT t.category
    FROM transactions t
    WHERE t.tenant_id = p_tenant_id
      AND t.category IS NOT NULL
    ORDER BY t.category;
$$;

-- ============================================
-- 3. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_distinct_store_names(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_distinct_categories(UUID) TO authenticated;
