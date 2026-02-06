-- Migration 049: Create excluded_items table for item exclusion/filtering system
-- Allows tenants to exclude certain menu items (modifiers, non-analytical items, etc.)
-- from analytics calculations.

-- 1. Create excluded_items table
CREATE TABLE IF NOT EXISTS public.excluded_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('modifier', 'non_analytical', 'low_volume', 'manual')),
    excluded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, menu_item_id)
);

-- 2. Index on tenant_id for fast lookups
CREATE INDEX idx_excluded_items_tenant ON public.excluded_items(tenant_id);

-- 3. Enable RLS
ALTER TABLE public.excluded_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
-- SELECT: users can see exclusions for their own tenant; operators see all
CREATE POLICY "Users can view own tenant exclusions" ON public.excluded_items
    FOR SELECT USING (
        tenant_id IN (
            SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- INSERT: owners can insert for their tenant; operators for any tenant
CREATE POLICY "Owners and operators can insert exclusions" ON public.excluded_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role = 'operator'
                OR (role = 'owner' AND tenant_id = excluded_items.tenant_id)
            )
        )
    );

-- DELETE: owners can delete for their tenant; operators for any tenant
CREATE POLICY "Owners and operators can delete exclusions" ON public.excluded_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role = 'operator'
                OR (role = 'owner' AND tenant_id = excluded_items.tenant_id)
            )
        )
    );

-- 5. Function to get exclusion suggestions
-- Identifies menu items that are likely modifiers, non-analytical, or low-volume
CREATE OR REPLACE FUNCTION public.get_exclusion_suggestions(p_tenant_id UUID)
RETURNS TABLE (
    menu_item_id UUID,
    item_name TEXT,
    category TEXT,
    total_quantity BIGINT,
    total_revenue BIGINT,
    revenue_pct NUMERIC,
    suggestion_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_revenue BIGINT;
BEGIN
    -- Get total revenue for percentage calculation
    SELECT COALESCE(SUM(mi.total_gross_revenue), 1)
    INTO v_total_revenue
    FROM public.menu_items mi
    WHERE mi.tenant_id = p_tenant_id
      AND mi.is_excluded = false;

    RETURN QUERY
    SELECT
        mi.id AS menu_item_id,
        mi.item_name,
        mi.category,
        mi.total_quantity,
        mi.total_gross_revenue AS total_revenue,
        ROUND((mi.total_gross_revenue::NUMERIC / v_total_revenue) * 100, 2) AS revenue_pct,
        CASE
            WHEN LOWER(mi.item_name) ~ '(add-on|extra|modifier|upsize|addon|add on)' THEN 'modifier_keyword'
            WHEN mi.total_quantity <= 1 THEN 'single_sale'
            WHEN (mi.total_gross_revenue::NUMERIC / v_total_revenue) * 100 < 0.1 THEN 'very_low_revenue'
            ELSE 'low_revenue'
        END AS suggestion_reason
    FROM public.menu_items mi
    WHERE mi.tenant_id = p_tenant_id
      AND mi.is_excluded = false
      -- Not already excluded
      AND NOT EXISTS (
          SELECT 1 FROM public.excluded_items ei
          WHERE ei.tenant_id = p_tenant_id
            AND ei.menu_item_id = mi.id
      )
      -- Match any of: modifier keywords, single sales, or <1% revenue
      AND (
          LOWER(mi.item_name) ~ '(add-on|extra|modifier|upsize|addon|add on)'
          OR mi.total_quantity <= 1
          OR (mi.total_gross_revenue::NUMERIC / v_total_revenue) * 100 < 1.0
      )
    ORDER BY mi.total_gross_revenue ASC
    LIMIT 100;
END;
$$;
