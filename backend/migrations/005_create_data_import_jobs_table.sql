-- Migration: Create data_import_jobs table (track import progress/audit)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 004_create_menu_items_table.sql

-- ============================================
-- 1. CREATE ENUM FOR STATUS
-- ============================================

CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================
-- 2. CREATE DATA_IMPORT_JOBS TABLE
-- ============================================

CREATE TABLE public.data_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Job details
    status import_status NOT NULL DEFAULT 'pending',
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER,

    -- Progress tracking
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    inserted_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,

    -- Results
    error_message TEXT,
    error_details JSONB,

    -- Date range of imported data
    date_range_start DATE,
    date_range_end DATE,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Audit
    created_by UUID REFERENCES public.users(id),
    import_type TEXT DEFAULT 'storehub'
);

-- ============================================
-- 3. CREATE INDEXES
-- ============================================

CREATE INDEX idx_import_jobs_tenant ON public.data_import_jobs(tenant_id);
CREATE INDEX idx_import_jobs_status ON public.data_import_jobs(status);
CREATE INDEX idx_import_jobs_created ON public.data_import_jobs(created_at);

-- ============================================
-- 4. ENABLE RLS
-- ============================================

ALTER TABLE public.data_import_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Users can view their own tenant's import jobs
CREATE POLICY "Users can view own tenant import jobs" ON public.data_import_jobs
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Owners and operators can create import jobs
CREATE POLICY "Owners and operators can create import jobs" ON public.data_import_jobs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'operator' OR (role = 'owner' AND tenant_id = data_import_jobs.tenant_id))
        )
    );

-- Operators can update import jobs (for status updates)
CREATE POLICY "Operators can update import jobs" ON public.data_import_jobs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Owners can update their own tenant's import jobs
CREATE POLICY "Owners can update own tenant import jobs" ON public.data_import_jobs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'owner'
            AND tenant_id = data_import_jobs.tenant_id
        )
    );

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON public.data_import_jobs TO authenticated;
