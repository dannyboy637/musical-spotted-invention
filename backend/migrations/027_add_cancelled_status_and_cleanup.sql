-- Migration: Add cancelled status and cleanup functions for import jobs
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER all previous migrations

-- ============================================
-- 1. ADD 'cancelled' TO import_status ENUM
-- ============================================

ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'cancelled';

-- ============================================
-- 2. CREATE CANCEL IMPORT JOB RPC FUNCTION
-- ============================================

-- Function to cancel an import job and delete its transactions
-- Returns: { success: boolean, transactions_deleted: integer, message: string }
CREATE OR REPLACE FUNCTION public.cancel_import_job(
    p_job_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_job RECORD;
    v_deleted_count INTEGER;
    v_user_role TEXT;
    v_user_tenant_id UUID;
BEGIN
    -- Get user role and tenant
    SELECT role, tenant_id INTO v_user_role, v_user_tenant_id
    FROM public.users WHERE id = p_user_id;

    -- Get job details
    SELECT * INTO v_job FROM public.data_import_jobs WHERE id = p_job_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'transactions_deleted', 0,
            'message', 'Job not found'
        );
    END IF;

    -- Check authorization: operators can cancel any, owners only their tenant
    IF v_user_role = 'viewer' THEN
        RETURN jsonb_build_object(
            'success', false,
            'transactions_deleted', 0,
            'message', 'Viewers cannot cancel imports'
        );
    END IF;

    IF v_user_role = 'owner' AND v_job.tenant_id != v_user_tenant_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'transactions_deleted', 0,
            'message', 'Access denied'
        );
    END IF;

    -- Only allow cancellation of pending/processing jobs
    IF v_job.status NOT IN ('pending', 'processing') THEN
        RETURN jsonb_build_object(
            'success', false,
            'transactions_deleted', 0,
            'message', 'Can only cancel pending or processing jobs'
        );
    END IF;

    -- Delete transactions from this import batch
    DELETE FROM public.transactions
    WHERE import_batch_id = p_job_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- Update job status to cancelled
    UPDATE public.data_import_jobs
    SET status = 'cancelled',
        completed_at = NOW(),
        error_message = 'Cancelled by user. ' || v_deleted_count || ' transactions deleted.'
    WHERE id = p_job_id;

    RETURN jsonb_build_object(
        'success', true,
        'transactions_deleted', v_deleted_count,
        'message', 'Job cancelled successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.cancel_import_job(UUID, UUID) TO authenticated;

-- ============================================
-- 3. CREATE STALE JOB CLEANUP FUNCTION
-- ============================================

-- Function to mark stale processing jobs as failed
-- A job is stale if it's been in 'processing' status for > timeout hours
-- Returns: { jobs_cleaned: integer, job_ids: uuid[] }
CREATE OR REPLACE FUNCTION public.cleanup_stale_import_jobs(
    p_timeout_hours INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    v_cleaned_ids UUID[];
    v_count INTEGER;
BEGIN
    -- Find and update stale jobs
    WITH stale_jobs AS (
        UPDATE public.data_import_jobs
        SET status = 'failed',
            completed_at = NOW(),
            error_message = 'Job timed out after ' || p_timeout_hours || ' hour(s). The import process may have been interrupted.'
        WHERE status = 'processing'
          AND started_at IS NOT NULL
          AND started_at < NOW() - (p_timeout_hours || ' hours')::INTERVAL
        RETURNING id
    )
    SELECT ARRAY_AGG(id), COUNT(*) INTO v_cleaned_ids, v_count
    FROM stale_jobs;

    RETURN jsonb_build_object(
        'jobs_cleaned', COALESCE(v_count, 0),
        'job_ids', COALESCE(v_cleaned_ids, ARRAY[]::UUID[])
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION public.cleanup_stale_import_jobs(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_import_jobs(INTEGER) TO service_role;
