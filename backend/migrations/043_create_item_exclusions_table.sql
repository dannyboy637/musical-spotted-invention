-- Migration 043: Create item_exclusions table for manual analytics filtering

CREATE TABLE public.item_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),

    UNIQUE (tenant_id, item_name)
);

CREATE INDEX idx_item_exclusions_tenant ON public.item_exclusions(tenant_id);
CREATE INDEX idx_item_exclusions_item ON public.item_exclusions(item_name);

ALTER TABLE public.item_exclusions ENABLE ROW LEVEL SECURITY;

-- Operators can view all exclusions
CREATE POLICY "Operators can view item exclusions" ON public.item_exclusions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Users can view their tenant's exclusions
CREATE POLICY "Users can view own tenant item exclusions" ON public.item_exclusions
    FOR SELECT USING (
        tenant_id IN (
            SELECT u.tenant_id FROM public.users u
            WHERE u.id = auth.uid()
        )
    );

-- Owners and operators can insert exclusions
CREATE POLICY "Owners and operators can insert item exclusions" ON public.item_exclusions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'operator' OR (role = 'owner' AND tenant_id = item_exclusions.tenant_id))
        )
    );

-- Owners and operators can delete exclusions
CREATE POLICY "Owners and operators can delete item exclusions" ON public.item_exclusions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'operator' OR (role = 'owner' AND tenant_id = item_exclusions.tenant_id))
        )
    );

GRANT SELECT, INSERT, DELETE ON public.item_exclusions TO authenticated;
