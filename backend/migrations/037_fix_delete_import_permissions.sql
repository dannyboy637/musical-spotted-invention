-- Migration 037: Fix delete_import_job permissions
--
-- ROOT CAUSE: Migration 036 created the delete_import_job function but forgot
-- the GRANT EXECUTE statement. Without it, the function could be called but
-- the DELETE inside would fail silently due to permission issues.
--
-- This migration adds the missing GRANT and recreates the function with
-- explicit schema qualification for robustness.
--
-- Run this migration in Supabase SQL Editor

-- Grant execute permission to authenticated users (THE MISSING PIECE)
GRANT EXECUTE ON FUNCTION public.delete_import_job(UUID, UUID) TO authenticated;

-- Recreate function with explicit schema qualification for robustness
CREATE OR REPLACE FUNCTION public.delete_import_job(p_job_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_job RECORD;
  v_user RECORD;
  v_deleted_count INT;
BEGIN
  -- Get job info (explicit schema)
  SELECT * INTO v_job FROM public.data_import_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Get user info (explicit schema)
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Authorization checks
  IF v_user.role = 'viewer' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Viewers cannot delete imports');
  END IF;

  IF v_user.role = 'owner' AND v_user.tenant_id != v_job.tenant_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete imports from other tenants');
  END IF;

  IF v_job.status IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete active imports. Use cancel instead.');
  END IF;

  IF v_job.status = 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Import already deleted');
  END IF;

  -- Delete transactions (explicit schema, SECURITY DEFINER bypasses RLS)
  DELETE FROM public.transactions WHERE import_batch_id = p_job_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Update job status
  UPDATE public.data_import_jobs
  SET status = 'deleted',
      deleted_at = NOW(),
      error_message = COALESCE(error_message || ' | ', '') || 'Deleted: ' || v_deleted_count || ' transactions removed.'
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'tenant_id', v_job.tenant_id,
    'transactions_deleted', v_deleted_count,
    'message', v_deleted_count || ' transactions deleted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add documentation
COMMENT ON FUNCTION public.delete_import_job IS
'Delete a completed/failed/cancelled import and all its transactions.
SECURITY DEFINER allows bypassing RLS to delete transactions.
Returns tenant_id for post-delete refresh operations.';
