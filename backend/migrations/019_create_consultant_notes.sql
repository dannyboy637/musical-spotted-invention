-- Migration: Create consultant_notes table for per-tenant notes
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 018_create_operator_tasks.sql

-- ============================================
-- 1. CREATE CONSULTANT_NOTES TABLE
-- ============================================

CREATE TABLE public.consultant_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_consultant_notes_tenant_id ON public.consultant_notes(tenant_id);
CREATE INDEX idx_consultant_notes_created_by ON public.consultant_notes(created_by);
CREATE INDEX idx_consultant_notes_is_pinned ON public.consultant_notes(is_pinned DESC, created_at DESC);

-- ============================================
-- 2. ENABLE RLS
-- ============================================

ALTER TABLE public.consultant_notes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS POLICIES (Operator only - private notes)
-- ============================================

-- Operators can view notes they created
CREATE POLICY "Operators can view own notes" ON public.consultant_notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'operator'
            AND id = public.consultant_notes.created_by
        )
    );

-- Operators can insert notes
CREATE POLICY "Operators can insert notes" ON public.consultant_notes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
        AND created_by = auth.uid()
    );

-- Operators can update their own notes
CREATE POLICY "Operators can update own notes" ON public.consultant_notes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'operator'
            AND id = public.consultant_notes.created_by
        )
    );

-- Operators can delete their own notes
CREATE POLICY "Operators can delete own notes" ON public.consultant_notes
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'operator'
            AND id = public.consultant_notes.created_by
        )
    );

-- ============================================
-- 4. UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER update_consultant_notes_updated_at
    BEFORE UPDATE ON public.consultant_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultant_notes TO authenticated;
