-- Migration: Create error_logs table for operator monitoring
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 015_add_report_period_type.sql

-- ============================================
-- 1. CREATE ERROR_LOGS TABLE
-- ============================================

CREATE TABLE public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    error_message TEXT,
    stack_trace TEXT,
    request_body TEXT,
    ip_address TEXT,
    user_agent TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_tenant_id ON public.error_logs(tenant_id);
CREATE INDEX idx_error_logs_status_code ON public.error_logs(status_code);
CREATE INDEX idx_error_logs_endpoint ON public.error_logs(endpoint);

-- ============================================
-- 2. ENABLE RLS
-- ============================================

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS POLICIES (Operator only)
-- ============================================

-- Only operators can view error logs
CREATE POLICY "Operators can view error_logs" ON public.error_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Only operators can insert error logs (via service role in middleware)
CREATE POLICY "Operators can insert error_logs" ON public.error_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- ============================================
-- 4. AUTO-DELETE OLD LOGS (Optional cleanup)
-- ============================================

-- Function to delete logs older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.error_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT ON public.error_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_error_logs() TO authenticated;
