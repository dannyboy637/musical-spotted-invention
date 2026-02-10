-- Migration 053: Optimize all RLS policies
-- Fixes two Supabase advisor issues across all 19 tables:
--   1. auth_rls_initplan (71 issues): auth.uid() re-evaluated per row
--      Fix: wrap in (SELECT auth.uid()) so it evaluates once per query
--   2. multiple_permissive_policies (75 issues): multiple permissive policies
--      for same role+action forces Postgres to evaluate all of them
--      Fix: consolidate into single policies with OR conditions
--
-- Access semantics are preserved exactly:
--   - operator: full access to all tenants
--   - owner: access to own tenant data
--   - viewer: read-only access to own tenant data

-- =============================================
-- USERS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Operators can read all users" ON public.users;
DROP POLICY IF EXISTS "Owners can read tenant users" ON public.users;
DROP POLICY IF EXISTS "Operators can update users" ON public.users;
DROP POLICY IF EXISTS "Owners can update tenant users" ON public.users;
DROP POLICY IF EXISTS "Operators can insert users" ON public.users;

CREATE POLICY "users_select" ON public.users FOR SELECT USING (
  id = (SELECT auth.uid())
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'owner'::user_role AND u.tenant_id = users.tenant_id)
);

CREATE POLICY "users_update" ON public.users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = users.tenant_id)
  ))
);

CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

-- =============================================
-- TENANTS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Operators can view all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Operators can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Operators can update tenants" ON public.tenants;
DROP POLICY IF EXISTS "Operators can delete tenants" ON public.tenants;

CREATE POLICY "tenants_select" ON public.tenants FOR SELECT USING (
  id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "tenants_insert" ON public.tenants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "tenants_delete" ON public.tenants FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

-- =============================================
-- TRANSACTIONS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Users can view own tenant transactions" ON public.transactions;
DROP POLICY IF EXISTS "Operators can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Owners can insert own tenant transactions" ON public.transactions;
DROP POLICY IF EXISTS "Operators can delete transactions" ON public.transactions;
DROP POLICY IF EXISTS "Owners can delete own tenant transactions" ON public.transactions;

CREATE POLICY "transactions_select" ON public.transactions FOR SELECT USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = transactions.tenant_id)
  ))
);

CREATE POLICY "transactions_delete" ON public.transactions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = transactions.tenant_id)
  ))
);

-- =============================================
-- MENU_ITEMS TABLE (public role)
-- Split ALL policies into per-action to eliminate multiple permissive
-- =============================================
DROP POLICY IF EXISTS "Operators can manage menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Owners can manage own tenant menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Users can view own tenant menu items" ON public.menu_items;

CREATE POLICY "menu_items_select" ON public.menu_items FOR SELECT USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "menu_items_insert" ON public.menu_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = menu_items.tenant_id)
  ))
);

CREATE POLICY "menu_items_update" ON public.menu_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = menu_items.tenant_id)
  ))
);

CREATE POLICY "menu_items_delete" ON public.menu_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = menu_items.tenant_id)
  ))
);

-- =============================================
-- ALERTS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Operators can view all alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can view own tenant alerts" ON public.alerts;
DROP POLICY IF EXISTS "Operators can insert alerts" ON public.alerts;
DROP POLICY IF EXISTS "Operators can update alerts" ON public.alerts;
DROP POLICY IF EXISTS "Owners can update own tenant alerts" ON public.alerts;

CREATE POLICY "alerts_select" ON public.alerts FOR SELECT USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "alerts_insert" ON public.alerts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "alerts_update" ON public.alerts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = alerts.tenant_id)
  ))
);

-- =============================================
-- ALERT_SETTINGS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Operators can view all alert_settings" ON public.alert_settings;
DROP POLICY IF EXISTS "Users can view own tenant alert_settings" ON public.alert_settings;
DROP POLICY IF EXISTS "Operators can insert alert_settings" ON public.alert_settings;
DROP POLICY IF EXISTS "Operators can update alert_settings" ON public.alert_settings;
DROP POLICY IF EXISTS "Owners can update own tenant alert_settings" ON public.alert_settings;

CREATE POLICY "alert_settings_select" ON public.alert_settings FOR SELECT USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "alert_settings_insert" ON public.alert_settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "alert_settings_update" ON public.alert_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = alert_settings.tenant_id)
  ))
);

-- =============================================
-- ALERT_SCAN_JOBS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Users can view own tenant alert scan jobs" ON public.alert_scan_jobs;
DROP POLICY IF EXISTS "Owners and operators can create alert scan jobs" ON public.alert_scan_jobs;
DROP POLICY IF EXISTS "Operators can update alert scan jobs" ON public.alert_scan_jobs;
DROP POLICY IF EXISTS "Owners can update own tenant alert scan jobs" ON public.alert_scan_jobs;

CREATE POLICY "alert_scan_jobs_select" ON public.alert_scan_jobs FOR SELECT USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "alert_scan_jobs_insert" ON public.alert_scan_jobs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = alert_scan_jobs.tenant_id)
  ))
);

CREATE POLICY "alert_scan_jobs_update" ON public.alert_scan_jobs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = alert_scan_jobs.tenant_id)
  ))
);

-- =============================================
-- DATA_IMPORT_JOBS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Users can view own tenant import jobs" ON public.data_import_jobs;
DROP POLICY IF EXISTS "Owners and operators can create import jobs" ON public.data_import_jobs;
DROP POLICY IF EXISTS "Operators can update import jobs" ON public.data_import_jobs;
DROP POLICY IF EXISTS "Owners can update own tenant import jobs" ON public.data_import_jobs;

CREATE POLICY "data_import_jobs_select" ON public.data_import_jobs FOR SELECT USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "data_import_jobs_insert" ON public.data_import_jobs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = data_import_jobs.tenant_id)
  ))
);

CREATE POLICY "data_import_jobs_update" ON public.data_import_jobs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = data_import_jobs.tenant_id)
  ))
);

-- =============================================
-- REPORTS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Operators can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Owners can view own tenant reports" ON public.reports;
DROP POLICY IF EXISTS "Operators can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Operators can update reports" ON public.reports;
DROP POLICY IF EXISTS "Operators can delete reports" ON public.reports;

CREATE POLICY "reports_select" ON public.reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = reports.tenant_id)
  ))
);

CREATE POLICY "reports_insert" ON public.reports FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "reports_update" ON public.reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "reports_delete" ON public.reports FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

-- =============================================
-- ERROR_LOGS TABLE (public role, operator-only)
-- =============================================
DROP POLICY IF EXISTS "Operators can view error_logs" ON public.error_logs;
DROP POLICY IF EXISTS "Operators can insert error_logs" ON public.error_logs;

CREATE POLICY "error_logs_select" ON public.error_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "error_logs_insert" ON public.error_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

-- =============================================
-- API_METRICS TABLE (public role, operator-only)
-- =============================================
DROP POLICY IF EXISTS "Operators can view api_metrics" ON public.api_metrics;

CREATE POLICY "api_metrics_select" ON public.api_metrics FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

-- =============================================
-- OPERATOR_TASKS TABLE (public role, operator + own-record)
-- =============================================
DROP POLICY IF EXISTS "Operators can view own tasks" ON public.operator_tasks;
DROP POLICY IF EXISTS "Operators can insert tasks" ON public.operator_tasks;
DROP POLICY IF EXISTS "Operators can update own tasks" ON public.operator_tasks;
DROP POLICY IF EXISTS "Operators can delete own tasks" ON public.operator_tasks;

CREATE POLICY "operator_tasks_select" ON public.operator_tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role AND u.id = operator_tasks.created_by)
);

CREATE POLICY "operator_tasks_insert" ON public.operator_tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
  AND created_by = (SELECT auth.uid())
);

CREATE POLICY "operator_tasks_update" ON public.operator_tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role AND u.id = operator_tasks.created_by)
);

CREATE POLICY "operator_tasks_delete" ON public.operator_tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role AND u.id = operator_tasks.created_by)
);

-- =============================================
-- CONSULTANT_NOTES TABLE (public role, operator + own-record)
-- =============================================
DROP POLICY IF EXISTS "Operators can view own notes" ON public.consultant_notes;
DROP POLICY IF EXISTS "Operators can insert notes" ON public.consultant_notes;
DROP POLICY IF EXISTS "Operators can update own notes" ON public.consultant_notes;
DROP POLICY IF EXISTS "Operators can delete own notes" ON public.consultant_notes;

CREATE POLICY "consultant_notes_select" ON public.consultant_notes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role AND u.id = consultant_notes.created_by)
);

CREATE POLICY "consultant_notes_insert" ON public.consultant_notes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
  AND created_by = (SELECT auth.uid())
);

CREATE POLICY "consultant_notes_update" ON public.consultant_notes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role AND u.id = consultant_notes.created_by)
);

CREATE POLICY "consultant_notes_delete" ON public.consultant_notes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role AND u.id = consultant_notes.created_by)
);

-- =============================================
-- BRANCH_SUMMARIES TABLE (authenticated role)
-- Split ALL policy into per-action, consolidate SELECT
-- =============================================
DROP POLICY IF EXISTS "branch_summaries_operator_all" ON public.branch_summaries;
DROP POLICY IF EXISTS "branch_summaries_tenant_read" ON public.branch_summaries;

CREATE POLICY "branch_summaries_select" ON public.branch_summaries FOR SELECT TO authenticated USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "branch_summaries_insert" ON public.branch_summaries FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "branch_summaries_update" ON public.branch_summaries FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "branch_summaries_delete" ON public.branch_summaries FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

-- =============================================
-- HOURLY_SUMMARIES TABLE (authenticated role)
-- =============================================
DROP POLICY IF EXISTS "hourly_summaries_operator_all" ON public.hourly_summaries;
DROP POLICY IF EXISTS "hourly_summaries_tenant_read" ON public.hourly_summaries;

CREATE POLICY "hourly_summaries_select" ON public.hourly_summaries FOR SELECT TO authenticated USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "hourly_summaries_insert" ON public.hourly_summaries FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "hourly_summaries_update" ON public.hourly_summaries FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "hourly_summaries_delete" ON public.hourly_summaries FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

-- =============================================
-- ITEM_PAIRS TABLE (authenticated role)
-- =============================================
DROP POLICY IF EXISTS "item_pairs_operator_all" ON public.item_pairs;
DROP POLICY IF EXISTS "item_pairs_tenant_read" ON public.item_pairs;

CREATE POLICY "item_pairs_select" ON public.item_pairs FOR SELECT TO authenticated USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "item_pairs_insert" ON public.item_pairs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "item_pairs_update" ON public.item_pairs FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "item_pairs_delete" ON public.item_pairs FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

-- =============================================
-- ITEM_EXCLUSIONS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Operators can view item exclusions" ON public.item_exclusions;
DROP POLICY IF EXISTS "Users can view own tenant item exclusions" ON public.item_exclusions;
DROP POLICY IF EXISTS "Owners and operators can insert item exclusions" ON public.item_exclusions;
DROP POLICY IF EXISTS "Owners and operators can delete item exclusions" ON public.item_exclusions;

CREATE POLICY "item_exclusions_select" ON public.item_exclusions FOR SELECT USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "item_exclusions_insert" ON public.item_exclusions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = item_exclusions.tenant_id)
  ))
);

CREATE POLICY "item_exclusions_delete" ON public.item_exclusions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = item_exclusions.tenant_id)
  ))
);

-- =============================================
-- EXCLUDED_ITEMS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Users can view own tenant exclusions" ON public.excluded_items;
DROP POLICY IF EXISTS "Owners and operators can insert exclusions" ON public.excluded_items;
DROP POLICY IF EXISTS "Owners and operators can delete exclusions" ON public.excluded_items;

CREATE POLICY "excluded_items_select" ON public.excluded_items FOR SELECT USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "excluded_items_insert" ON public.excluded_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = excluded_items.tenant_id)
  ))
);

CREATE POLICY "excluded_items_delete" ON public.excluded_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = excluded_items.tenant_id)
  ))
);

-- =============================================
-- WATCHED_ITEMS TABLE (public role)
-- =============================================
DROP POLICY IF EXISTS "Operators can view watched items" ON public.watched_items;
DROP POLICY IF EXISTS "Users can view own tenant watched items" ON public.watched_items;
DROP POLICY IF EXISTS "Owners and operators can insert watched items" ON public.watched_items;
DROP POLICY IF EXISTS "Owners and operators can update watched items" ON public.watched_items;
DROP POLICY IF EXISTS "Owners and operators can delete watched items" ON public.watched_items;

CREATE POLICY "watched_items_select" ON public.watched_items FOR SELECT USING (
  tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'operator'::user_role)
);

CREATE POLICY "watched_items_insert" ON public.watched_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = watched_items.tenant_id)
  ))
);

CREATE POLICY "watched_items_update" ON public.watched_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = watched_items.tenant_id)
  ))
);

CREATE POLICY "watched_items_delete" ON public.watched_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (
    u.role = 'operator'::user_role
    OR (u.role = 'owner'::user_role AND u.tenant_id = watched_items.tenant_id)
  ))
);
