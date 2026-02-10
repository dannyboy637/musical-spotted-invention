-- Migration 054: Index cleanup
-- Drops 29 unused indexes, removes 1 duplicate, adds 10 missing FK indexes,
-- and restores 6 FK-covering indexes that were needed despite zero query usage.
-- Resolves all unused_index, duplicate_index, and unindexed_foreign_keys advisories.

-- =============================================
-- DROP 29 UNUSED INDEXES
-- These have never been used by any query since creation.
-- =============================================
DROP INDEX IF EXISTS public.idx_transactions_macro_category;
DROP INDEX IF EXISTS public.idx_error_logs_status_code;
DROP INDEX IF EXISTS public.idx_error_logs_endpoint;
DROP INDEX IF EXISTS public.idx_item_exclusions_item;
DROP INDEX IF EXISTS public.idx_tenants_is_active;
DROP INDEX IF EXISTS public.idx_pairs_tenant_item_a;
DROP INDEX IF EXISTS public.idx_transactions_bundle_analysis;
DROP INDEX IF EXISTS public.idx_reports_status;
DROP INDEX IF EXISTS public.idx_reports_created_at;
DROP INDEX IF EXISTS public.idx_operator_tasks_created_by;
DROP INDEX IF EXISTS public.idx_alert_settings_tenant;
DROP INDEX IF EXISTS public.idx_operator_tasks_due_date;
DROP INDEX IF EXISTS public.idx_operator_tasks_user_status;
DROP INDEX IF EXISTS public.idx_consultant_notes_tenant_user;
DROP INDEX IF EXISTS public.idx_watched_items_tenant;
DROP INDEX IF EXISTS public.idx_watched_items_item;
DROP INDEX IF EXISTS public.idx_import_jobs_tenant;
DROP INDEX IF EXISTS public.idx_menu_items_cost_percentage;
DROP INDEX IF EXISTS public.idx_hourly_tenant_store;
DROP INDEX IF EXISTS public.idx_consultant_notes_is_pinned;
DROP INDEX IF EXISTS public.idx_import_jobs_deleted_at;
DROP INDEX IF EXISTS public.idx_alert_scan_jobs_tenant;
DROP INDEX IF EXISTS public.idx_alert_scan_jobs_status;
DROP INDEX IF EXISTS public.idx_alert_scan_jobs_created;

-- =============================================
-- DROP 1 DUPLICATE INDEX
-- idx_transactions_analytics_main is identical to idx_transactions_analytics_primary
-- Both: btree (tenant_id, receipt_timestamp DESC)
-- =============================================
DROP INDEX IF EXISTS public.idx_transactions_analytics_main;

-- =============================================
-- ADD 10 MISSING FOREIGN KEY INDEXES
-- FK constraints without covering indexes cause slow cascading operations.
-- =============================================
CREATE INDEX IF NOT EXISTS idx_alert_scan_jobs_created_by ON public.alert_scan_jobs (created_by);
CREATE INDEX IF NOT EXISTS idx_alerts_dismissed_by ON public.alerts (dismissed_by);
CREATE INDEX IF NOT EXISTS idx_data_import_jobs_created_by ON public.data_import_jobs (created_by);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_excluded_items_excluded_by ON public.excluded_items (excluded_by);
CREATE INDEX IF NOT EXISTS idx_excluded_items_menu_item_id ON public.excluded_items (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_item_exclusions_created_by ON public.item_exclusions (created_by);
CREATE INDEX IF NOT EXISTS idx_reports_approved_by ON public.reports (approved_by);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_watched_items_created_by ON public.watched_items (created_by);

-- =============================================
-- RESTORE 6 FK-COVERING INDEXES
-- These were dropped as "unused" in the batch above, but they cover FK constraints
-- on tenant_id/created_by columns needed for cascading deletes/updates.
-- Recreated with the same column definitions.
-- =============================================
CREATE INDEX IF NOT EXISTS idx_alert_scan_jobs_tenant_id ON public.alert_scan_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_metrics_tenant_id ON public.api_metrics (tenant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_notes_created_by ON public.consultant_notes (created_by);
CREATE INDEX IF NOT EXISTS idx_consultant_notes_tenant_id ON public.consultant_notes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_id ON public.error_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_operator_tasks_tenant_id ON public.operator_tasks (tenant_id);
