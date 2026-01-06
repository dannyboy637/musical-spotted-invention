-- Migration: Add is_active column to tenants for soft delete
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 019_create_consultant_notes.sql

-- ============================================
-- 1. ADD IS_ACTIVE COLUMN
-- ============================================

ALTER TABLE public.tenants
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Index for filtering active tenants
CREATE INDEX idx_tenants_is_active ON public.tenants(is_active);

-- ============================================
-- 2. ADD UPDATED_AT COLUMN (if not exists)
-- ============================================

-- Check if updated_at exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'tenants'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.tenants
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- ============================================
-- 3. ADD UPDATED_AT TRIGGER (if function exists)
-- ============================================

-- Only create trigger if the update_updated_at function exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'update_updated_at'
    ) THEN
        -- Drop trigger if exists to avoid conflict
        DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;

        CREATE TRIGGER update_tenants_updated_at
            BEFORE UPDATE ON public.tenants
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;
END $$;

-- ============================================
-- 4. HELPER FUNCTION: Get active tenants with stats
-- ============================================

CREATE OR REPLACE FUNCTION public.get_tenant_health_stats()
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tenant_slug TEXT,
    is_active BOOLEAN,
    last_import_at TIMESTAMPTZ,
    import_row_count BIGINT,
    alert_count BIGINT,
    critical_alert_count BIGINT,
    user_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        t.is_active,
        (
            SELECT MAX(dij.created_at)
            FROM public.data_import_jobs dij
            WHERE dij.tenant_id = t.id AND dij.status = 'completed'
        ) as last_import_at,
        (
            SELECT COALESCE(SUM(dij.row_count), 0)::BIGINT
            FROM public.data_import_jobs dij
            WHERE dij.tenant_id = t.id AND dij.status = 'completed'
        ) as import_row_count,
        (
            SELECT COUNT(*)::BIGINT
            FROM public.alerts a
            WHERE a.tenant_id = t.id AND a.dismissed_at IS NULL
        ) as alert_count,
        (
            SELECT COUNT(*)::BIGINT
            FROM public.alerts a
            WHERE a.tenant_id = t.id
            AND a.dismissed_at IS NULL
            AND a.severity = 'critical'
        ) as critical_alert_count,
        (
            SELECT COUNT(*)::BIGINT
            FROM public.users u
            WHERE u.tenant_id = t.id
        ) as user_count
    FROM public.tenants t
    ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.get_tenant_health_stats() TO authenticated;
