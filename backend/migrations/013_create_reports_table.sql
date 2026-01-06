-- Migration: Create reports table for scheduled email reports
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 012_create_alerts_system.sql

-- ============================================
-- 1. CREATE REPORT STATUS ENUM
-- ============================================

CREATE TYPE report_status AS ENUM ('pending', 'approved', 'sent');
CREATE TYPE narrative_style AS ENUM ('full', 'bullets');

-- ============================================
-- 2. CREATE REPORTS TABLE
-- ============================================

CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Period covered by report
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Status workflow
    status report_status NOT NULL DEFAULT 'pending',

    -- AI narrative
    narrative_style narrative_style NOT NULL DEFAULT 'full',
    narrative_text TEXT,  -- Editable by operator

    -- Report data (JSONB for flexibility)
    report_data JSONB NOT NULL DEFAULT '{}',
    -- Structure: {
    --   kpis: { revenue, transactions, avg_check, revenue_change_pct, ... },
    --   top_items: [{ name, revenue, quantity, ... }],
    --   gainers: [{ name, change_pct, ... }],
    --   decliners: [{ name, change_pct, ... }],
    --   alerts: [{ type, title, message, ... }]
    -- }

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,

    -- Audit trail
    approved_by UUID REFERENCES public.users(id),
    recipient_email TEXT  -- Snapshot of recipient at send time
);

-- Indexes for efficient queries
CREATE INDEX idx_reports_tenant_id ON public.reports(tenant_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX idx_reports_period ON public.reports(period_start, period_end);

-- ============================================
-- 3. ENABLE RLS
-- ============================================

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS POLICIES FOR REPORTS
-- ============================================

-- Operators can view all reports
CREATE POLICY "Operators can view all reports" ON public.reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Owners can view their tenant's reports
CREATE POLICY "Owners can view own tenant reports" ON public.reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'owner'
            AND u.tenant_id = public.reports.tenant_id
        )
    );

-- Operators can insert reports
CREATE POLICY "Operators can insert reports" ON public.reports
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Operators can update any report
CREATE POLICY "Operators can update reports" ON public.reports
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Operators can delete reports (e.g., discard drafts)
CREATE POLICY "Operators can delete reports" ON public.reports
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
