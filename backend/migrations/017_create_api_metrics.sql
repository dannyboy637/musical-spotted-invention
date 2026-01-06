-- Migration: Create api_metrics table for performance monitoring
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 016_create_error_logs.sql

-- ============================================
-- 1. CREATE API_METRICS TABLE
-- ============================================

CREATE TABLE public.api_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient aggregation queries
CREATE INDEX idx_api_metrics_created_at ON public.api_metrics(created_at DESC);
CREATE INDEX idx_api_metrics_endpoint ON public.api_metrics(endpoint);
CREATE INDEX idx_api_metrics_tenant_id ON public.api_metrics(tenant_id);

-- Composite index for time-range queries with endpoint filtering
CREATE INDEX idx_api_metrics_time_endpoint ON public.api_metrics(created_at, endpoint);

-- ============================================
-- 2. ENABLE RLS
-- ============================================

ALTER TABLE public.api_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS POLICIES (Operator only)
-- ============================================

-- Only operators can view metrics
CREATE POLICY "Operators can view api_metrics" ON public.api_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'operator'
        )
    );

-- Service role handles inserts (bypasses RLS)
-- No insert policy needed for authenticated users

-- ============================================
-- 4. AGGREGATION FUNCTIONS
-- ============================================

-- Get endpoint performance stats
CREATE OR REPLACE FUNCTION public.get_endpoint_stats(
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    endpoint TEXT,
    method TEXT,
    call_count BIGINT,
    avg_response_ms NUMERIC,
    p50_response_ms NUMERIC,
    p95_response_ms NUMERIC,
    p99_response_ms NUMERIC,
    error_count BIGINT,
    error_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.endpoint,
        m.method,
        COUNT(*)::BIGINT as call_count,
        ROUND(AVG(m.response_time_ms)::NUMERIC, 2) as avg_response_ms,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.response_time_ms)::NUMERIC, 2) as p50_response_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.response_time_ms)::NUMERIC, 2) as p95_response_ms,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY m.response_time_ms)::NUMERIC, 2) as p99_response_ms,
        COUNT(*) FILTER (WHERE m.status_code >= 400)::BIGINT as error_count,
        ROUND((COUNT(*) FILTER (WHERE m.status_code >= 400)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as error_rate
    FROM public.api_metrics m
    WHERE m.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY m.endpoint, m.method
    ORDER BY call_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get slow endpoints (>300ms average)
CREATE OR REPLACE FUNCTION public.get_slow_endpoints(
    p_hours INTEGER DEFAULT 24,
    p_threshold_ms INTEGER DEFAULT 300
)
RETURNS TABLE (
    endpoint TEXT,
    method TEXT,
    avg_response_ms NUMERIC,
    p95_response_ms NUMERIC,
    call_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.endpoint,
        m.method,
        ROUND(AVG(m.response_time_ms)::NUMERIC, 2) as avg_response_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.response_time_ms)::NUMERIC, 2) as p95_response_ms,
        COUNT(*)::BIGINT as call_count
    FROM public.api_metrics m
    WHERE m.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY m.endpoint, m.method
    HAVING AVG(m.response_time_ms) > p_threshold_ms
    ORDER BY avg_response_ms DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get hourly metrics for charting
CREATE OR REPLACE FUNCTION public.get_hourly_metrics(
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    hour TIMESTAMPTZ,
    request_count BIGINT,
    avg_response_ms NUMERIC,
    error_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc('hour', m.created_at) as hour,
        COUNT(*)::BIGINT as request_count,
        ROUND(AVG(m.response_time_ms)::NUMERIC, 2) as avg_response_ms,
        COUNT(*) FILTER (WHERE m.status_code >= 400)::BIGINT as error_count
    FROM public.api_metrics m
    WHERE m.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY date_trunc('hour', m.created_at)
    ORDER BY hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. AUTO-DELETE OLD METRICS (keep 7 days)
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_old_api_metrics()
RETURNS void AS $$
BEGIN
    DELETE FROM public.api_metrics
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT ON public.api_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_endpoint_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_slow_endpoints(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hourly_metrics(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_api_metrics() TO authenticated;
