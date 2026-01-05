-- Migration: Create alerts system (tables, RLS)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 011_create_bundles_rpc.sql

-- ============================================
-- 1. CREATE ALERT SEVERITY ENUM
-- ============================================

CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

-- ============================================
-- 2. CREATE ALERT SETTINGS TABLE (per-tenant thresholds)
-- ============================================

CREATE TABLE public.alert_settings (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    revenue_drop_pct INTEGER NOT NULL DEFAULT 20,
    item_spike_pct INTEGER NOT NULL DEFAULT 50,
    item_crash_pct INTEGER NOT NULL DEFAULT 50,
    quadrant_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. CREATE ALERTS TABLE
-- ============================================

CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL,  -- revenue_drop, item_spike, item_crash, new_star, new_dog
    severity alert_severity NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',  -- {item_id, item_name, old_value, new_value, period, etc.}
    fingerprint TEXT NOT NULL,  -- for deduplication: type:item_id:period
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dismissed_at TIMESTAMPTZ,
    dismissed_by UUID REFERENCES public.users(id)
);

-- Index for efficient tenant queries
CREATE INDEX idx_alerts_tenant_id ON public.alerts(tenant_id);
CREATE INDEX idx_alerts_fingerprint ON public.alerts(fingerprint);
CREATE INDEX idx_alerts_created_at ON public.alerts(created_at DESC);

-- Unique constraint to prevent duplicate alerts within cooldown period
-- (handled in application logic with fingerprint check)

-- ============================================
-- 4. ENABLE RLS
-- ============================================

ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES FOR ALERT_SETTINGS
-- ============================================

-- Operators can view all alert settings
CREATE POLICY "Operators can view all alert_settings" ON public.alert_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Users can view their tenant's alert settings
CREATE POLICY "Users can view own tenant alert_settings" ON public.alert_settings
    FOR SELECT USING (
        tenant_id IN (
            SELECT u.tenant_id FROM public.users u
            WHERE u.id = auth.uid()
        )
    );

-- Operators can insert alert settings
CREATE POLICY "Operators can insert alert_settings" ON public.alert_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Operators can update any alert settings
CREATE POLICY "Operators can update alert_settings" ON public.alert_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Owners can update their tenant's alert settings
CREATE POLICY "Owners can update own tenant alert_settings" ON public.alert_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'owner'
            AND u.tenant_id = public.alert_settings.tenant_id
        )
    );

-- ============================================
-- 6. RLS POLICIES FOR ALERTS
-- ============================================

-- Operators can view all alerts
CREATE POLICY "Operators can view all alerts" ON public.alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Users can view their tenant's alerts
CREATE POLICY "Users can view own tenant alerts" ON public.alerts
    FOR SELECT USING (
        tenant_id IN (
            SELECT u.tenant_id FROM public.users u
            WHERE u.id = auth.uid()
        )
    );

-- Operators can insert alerts (for scan results)
CREATE POLICY "Operators can insert alerts" ON public.alerts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Service role can insert alerts (for background jobs)
-- Note: Service role bypasses RLS, so this is just for documentation

-- Operators can update any alert (dismiss)
CREATE POLICY "Operators can update alerts" ON public.alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Owners can update (dismiss) their tenant's alerts
CREATE POLICY "Owners can update own tenant alerts" ON public.alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'owner'
            AND u.tenant_id = public.alerts.tenant_id
        )
    );

-- ============================================
-- 7. TRIGGER FOR ALERT_SETTINGS UPDATED_AT
-- ============================================

CREATE TRIGGER update_alert_settings_updated_at
    BEFORE UPDATE ON public.alert_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON public.alert_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.alerts TO authenticated;

-- ============================================
-- 9. HELPER FUNCTION: Get or create alert settings for a tenant
-- ============================================

CREATE OR REPLACE FUNCTION public.get_or_create_alert_settings(p_tenant_id UUID)
RETURNS public.alert_settings AS $$
DECLARE
    result public.alert_settings;
BEGIN
    SELECT * INTO result FROM public.alert_settings WHERE tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        INSERT INTO public.alert_settings (tenant_id)
        VALUES (p_tenant_id)
        RETURNING * INTO result;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_alert_settings(UUID) TO authenticated;
