-- Migration 046: Create watched_items table for item monitoring

CREATE TABLE public.watched_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    revenue_drop_pct INTEGER NOT NULL DEFAULT 20,
    revenue_spike_pct INTEGER NOT NULL DEFAULT 50,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),

    UNIQUE (tenant_id, item_name)
);

CREATE INDEX idx_watched_items_tenant ON public.watched_items(tenant_id);
CREATE INDEX idx_watched_items_item ON public.watched_items(item_name);

ALTER TABLE public.watched_items ENABLE ROW LEVEL SECURITY;

-- Operators can view all watched items
CREATE POLICY "Operators can view watched items" ON public.watched_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Users can view their tenant's watched items
CREATE POLICY "Users can view own tenant watched items" ON public.watched_items
    FOR SELECT USING (
        tenant_id IN (
            SELECT u.tenant_id FROM public.users u
            WHERE u.id = auth.uid()
        )
    );

-- Owners and operators can insert watched items
CREATE POLICY "Owners and operators can insert watched items" ON public.watched_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'operator' OR (role = 'owner' AND tenant_id = watched_items.tenant_id))
        )
    );

-- Owners and operators can update watched items
CREATE POLICY "Owners and operators can update watched items" ON public.watched_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'operator' OR (role = 'owner' AND tenant_id = watched_items.tenant_id))
        )
    );

-- Owners and operators can delete watched items
CREATE POLICY "Owners and operators can delete watched items" ON public.watched_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'operator' OR (role = 'owner' AND tenant_id = watched_items.tenant_id))
        )
    );

CREATE TRIGGER update_watched_items_updated_at
    BEFORE UPDATE ON public.watched_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watched_items TO authenticated;
