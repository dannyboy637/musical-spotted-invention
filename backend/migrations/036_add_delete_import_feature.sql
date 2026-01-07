-- Migration 036: Add delete import feature
-- Allows users to delete completed imports and their transactions
--
-- Run this migration in Supabase SQL Editor

-- Add 'deleted' to import_status enum
ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'deleted';

-- Add deleted_at column for tracking when imports were deleted
ALTER TABLE data_import_jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for deleted_at queries
CREATE INDEX IF NOT EXISTS idx_import_jobs_deleted_at
ON data_import_jobs(deleted_at)
WHERE deleted_at IS NOT NULL;

-- RPC function for atomic delete operation
-- Validates authorization, deletes transactions, updates job status
CREATE OR REPLACE FUNCTION delete_import_job(p_job_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_job RECORD;
  v_user RECORD;
  v_deleted_count INT;
BEGIN
  -- Get job info
  SELECT * INTO v_job FROM data_import_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Get user info
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Authorization: operator can delete any, owner can delete own tenant
  IF v_user.role = 'viewer' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Viewers cannot delete imports');
  END IF;

  IF v_user.role = 'owner' AND v_user.tenant_id != v_job.tenant_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete imports from other tenants');
  END IF;

  -- Only allow delete on completed/failed/cancelled jobs (not pending/processing)
  IF v_job.status IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete active imports. Use cancel instead.');
  END IF;

  -- Already deleted? Return early
  IF v_job.status = 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Import already deleted');
  END IF;

  -- Delete transactions linked to this import
  DELETE FROM transactions WHERE import_batch_id = p_job_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Update job status to deleted
  UPDATE data_import_jobs
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

-- Add comment for documentation
COMMENT ON FUNCTION delete_import_job IS 'Delete a completed/failed/cancelled import and all its transactions. Returns tenant_id for post-delete refresh operations.';
