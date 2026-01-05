-- Migration: Create tenants table and update user roles
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 001_create_users_table.sql

-- ============================================
-- 1. CREATE TENANTS TABLE
-- ============================================

CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 3. ADD TENANT_ID TO USERS
-- ============================================

ALTER TABLE public.users ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- ============================================
-- 4. ENABLE RLS ON TENANTS TABLE
-- ============================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES FOR TENANTS TABLE
-- ============================================

-- Operators can see all tenants
CREATE POLICY "Operators can view all tenants" ON public.tenants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Users can see their own tenant
CREATE POLICY "Users can view own tenant" ON public.tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM public.users
            WHERE id = auth.uid()
        )
    );

-- Operators can insert tenants
CREATE POLICY "Operators can insert tenants" ON public.tenants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Operators can update tenants
CREATE POLICY "Operators can update tenants" ON public.tenants
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Operators can delete tenants
CREATE POLICY "Operators can delete tenants" ON public.tenants
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- ============================================
-- 5. ADD TENANT-SCOPED POLICIES FOR OWNERS
-- ============================================

-- Owners can read users in their tenant
CREATE POLICY "Owners can read tenant users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'owner'
            AND u.tenant_id = public.users.tenant_id
        )
    );


-- Owners can update users in their tenant
CREATE POLICY "Owners can update tenant users" ON public.users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'owner'
            AND u.tenant_id = public.users.tenant_id
        )
    );

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;

-- ============================================
-- 8. INSERT SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment to add sample tenants:
-- INSERT INTO public.tenants (name, slug) VALUES
--     ('Demo Restaurant', 'demo-restaurant'),
--     ('Test Bistro', 'test-bistro');
