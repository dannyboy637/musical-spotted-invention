-- Migration 041: Create alert_scan_jobs table for async scan tracking

-- ============================================
-- 1. CREATE ENUM FOR STATUS
-- ============================================

CREATE TYPE alert_scan_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================
-- 2. CREATE ALERT_SCAN_JOBS TABLE
-- ============================================

CREATE TABLE public.alert_scan_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    status alert_scan_status NOT NULL DEFAULT 'pending',
    alerts_created INTEGER DEFAULT 0,
    scan_duration_ms INTEGER,
    error_message TEXT,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    created_by UUID REFERENCES public.users(id)
);

-- ============================================
-- 3. CREATE INDEXES
-- ============================================

CREATE INDEX idx_alert_scan_jobs_tenant ON public.alert_scan_jobs(tenant_id);
CREATE INDEX idx_alert_scan_jobs_status ON public.alert_scan_jobs(status);
CREATE INDEX idx_alert_scan_jobs_created ON public.alert_scan_jobs(created_at DESC);

-- ============================================
-- 4. ENABLE RLS
-- ============================================

ALTER TABLE public.alert_scan_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Users can view their own tenant's scan jobs
CREATE POLICY "Users can view own tenant alert scan jobs" ON public.alert_scan_jobs
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Owners and operators can create scan jobs
CREATE POLICY "Owners and operators can create alert scan jobs" ON public.alert_scan_jobs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'operator' OR (role = 'owner' AND tenant_id = alert_scan_jobs.tenant_id))
        )
    );

-- Operators can update any scan job
CREATE POLICY "Operators can update alert scan jobs" ON public.alert_scan_jobs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Owners can update their own tenant's scan jobs
CREATE POLICY "Owners can update own tenant alert scan jobs" ON public.alert_scan_jobs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'owner'
            AND tenant_id = alert_scan_jobs.tenant_id
        )
    );

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON public.alert_scan_jobs TO authenticated;
