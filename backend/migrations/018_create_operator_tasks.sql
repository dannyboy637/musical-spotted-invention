-- Migration: Create operator_tasks table for personal task management
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 017_create_api_metrics.sql

-- ============================================
-- 1. CREATE OPERATOR_TASKS TABLE
-- ============================================

CREATE TABLE public.operator_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_operator_tasks_created_by ON public.operator_tasks(created_by);
CREATE INDEX idx_operator_tasks_status ON public.operator_tasks(status);
CREATE INDEX idx_operator_tasks_due_date ON public.operator_tasks(due_date);
CREATE INDEX idx_operator_tasks_tenant_id ON public.operator_tasks(tenant_id);

-- ============================================
-- 2. ENABLE RLS
-- ============================================

ALTER TABLE public.operator_tasks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS POLICIES (Operator only - personal tasks)
-- ============================================

-- Operators can view their own tasks
CREATE POLICY "Operators can view own tasks" ON public.operator_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'operator'
            AND id = public.operator_tasks.created_by
        )
    );

-- Operators can insert their own tasks
CREATE POLICY "Operators can insert tasks" ON public.operator_tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
        AND created_by = auth.uid()
    );

-- Operators can update their own tasks
CREATE POLICY "Operators can update own tasks" ON public.operator_tasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'operator'
            AND id = public.operator_tasks.created_by
        )
    );

-- Operators can delete their own tasks
CREATE POLICY "Operators can delete own tasks" ON public.operator_tasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'operator'
            AND id = public.operator_tasks.created_by
        )
    );

-- ============================================
-- 4. UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER update_operator_tasks_updated_at
    BEFORE UPDATE ON public.operator_tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_tasks TO authenticated;
