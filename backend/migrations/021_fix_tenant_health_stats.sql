-- Migration: Fix tenant health stats to check transaction data, not just import_jobs
-- Run this in Supabase SQL Editor
-- IMPORTANT: Run this AFTER 020_add_tenant_is_active.sql

-- First drop the existing function (return type changed)
DROP FUNCTION IF EXISTS public.get_tenant_health_stats();

-- Recreate with improved logic
CREATE OR REPLACE FUNCTION public.get_tenant_health_stats()
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tenant_slug TEXT,
    is_active BOOLEAN,
    last_data_at TIMESTAMPTZ,
    total_transactions BIGINT,
    alert_count BIGINT,
    critical_alert_count BIGINT,
    user_count BIGINT,
    total_revenue BIGINT,
    recent_revenue BIGINT,
    recent_transactions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        COALESCE(t.is_active, true) as is_active,
        -- Use most recent transaction timestamp OR import job timestamp
        GREATEST(
            (SELECT MAX(tr.receipt_timestamp) FROM public.transactions tr WHERE tr.tenant_id = t.id),
            (SELECT MAX(dij.created_at) FROM public.data_import_jobs dij WHERE dij.tenant_id = t.id AND dij.status = 'completed')
        ) as last_data_at,
        -- Total transaction count
        (SELECT COUNT(*)::BIGINT FROM public.transactions tr WHERE tr.tenant_id = t.id) as total_transactions,
        -- Active alert count
        (
            SELECT COUNT(*)::BIGINT
            FROM public.alerts a
            WHERE a.tenant_id = t.id AND a.dismissed_at IS NULL
        ) as alert_count,
        -- Critical alert count
        (
            SELECT COUNT(*)::BIGINT
            FROM public.alerts a
            WHERE a.tenant_id = t.id
            AND a.dismissed_at IS NULL
            AND a.severity = 'critical'
        ) as critical_alert_count,
        -- User count
        (SELECT COUNT(*)::BIGINT FROM public.users u WHERE u.tenant_id = t.id) as user_count,
        -- Total revenue (all time)
        COALESCE((SELECT SUM(tr.gross_revenue)::BIGINT FROM public.transactions tr WHERE tr.tenant_id = t.id), 0) as total_revenue,
        -- Recent revenue (last 7 days)
        COALESCE((
            SELECT SUM(tr.gross_revenue)::BIGINT
            FROM public.transactions tr
            WHERE tr.tenant_id = t.id
            AND tr.receipt_timestamp > NOW() - INTERVAL '7 days'
        ), 0) as recent_revenue,
        -- Recent transaction count (last 7 days)
        (
            SELECT COUNT(*)::BIGINT
            FROM public.transactions tr
            WHERE tr.tenant_id = t.id
            AND tr.receipt_timestamp > NOW() - INTERVAL '7 days'
        ) as recent_transactions
    FROM public.tenants t
    ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_tenant_health_stats() TO authenticated;
