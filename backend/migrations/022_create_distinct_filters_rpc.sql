-- Migration 022: Create efficient RPC functions for distinct filter values
-- These replace the inefficient fallback queries that fetch 10000 rows

-- Get distinct store names for a tenant
CREATE OR REPLACE FUNCTION public.get_distinct_store_names(p_tenant_id UUID)
RETURNS TABLE (store_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT t.store_name
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.store_name IS NOT NULL
    AND t.store_name != ''
  ORDER BY t.store_name;
$$;

-- Get distinct categories for a tenant
CREATE OR REPLACE FUNCTION public.get_distinct_categories(p_tenant_id UUID)
RETURNS TABLE (category TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT t.category
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.category IS NOT NULL
    AND t.category != ''
  ORDER BY t.category;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_distinct_store_names(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_store_names(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_distinct_categories(UUID) TO service_role;

-- Create indexes to speed up distinct queries if they don't exist
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_store ON transactions(tenant_id, store_name) WHERE store_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_category ON transactions(tenant_id, category) WHERE category IS NOT NULL;
