-- Migration 023: Add performance indexes for slow endpoints
-- Addresses slow queries on data_import_jobs, alerts, and alert_settings

-- Index for data_import_jobs listing (sorted by created_at)
CREATE INDEX IF NOT EXISTS idx_data_import_jobs_tenant_created
ON data_import_jobs(tenant_id, created_at DESC);

-- Index for alerts listing
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_dismissed_created
ON alerts(tenant_id, dismissed_at NULLS FIRST, created_at DESC);

-- Index for alert_settings by tenant
CREATE INDEX IF NOT EXISTS idx_alert_settings_tenant
ON alert_settings(tenant_id);

-- Composite index for api_metrics queries
CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint_created
ON api_metrics(endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_metrics_created_at
ON api_metrics(created_at DESC);

-- Index for error_logs queries
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
ON error_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint
ON error_logs(endpoint, created_at DESC);

-- Indexes for operator_tasks queries
CREATE INDEX IF NOT EXISTS idx_operator_tasks_user_status
ON operator_tasks(created_by, status);

CREATE INDEX IF NOT EXISTS idx_operator_tasks_user_due
ON operator_tasks(created_by, status, due_date) WHERE status = 'pending';

-- Indexes for consultant_notes queries
CREATE INDEX IF NOT EXISTS idx_consultant_notes_tenant_user
ON consultant_notes(tenant_id, created_by, is_pinned DESC, created_at DESC);
