-- Migration 048: Set search_path on all public functions to prevent search_path injection
-- Uses ALTER FUNCTION which preserves existing config (statement_timeout, etc.)
-- Resolves all "Function Search Path Mutable" security advisor warnings.

ALTER FUNCTION public.aggregate_menu_items(uuid) SET search_path = public;
ALTER FUNCTION public.cancel_import_job(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.cleanup_old_api_metrics() SET search_path = public;
ALTER FUNCTION public.cleanup_old_error_logs() SET search_path = public;
ALTER FUNCTION public.cleanup_stale_import_jobs(integer) SET search_path = public;
ALTER FUNCTION public.delete_import_job(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.get_analytics_branches(uuid, date, date, text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_branches_v2(uuid, date, date, text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_bundles(uuid, text, text, text[], integer, integer) SET search_path = public;
ALTER FUNCTION public.get_analytics_bundles_v2(uuid, date, date, text[], integer, integer) SET search_path = public;
ALTER FUNCTION public.get_analytics_categories(uuid, date, date, text[], boolean) SET search_path = public;
ALTER FUNCTION public.get_analytics_categories_v2(uuid, date, date, text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_category_by_branch_v2(uuid, text, date, date) SET search_path = public;
ALTER FUNCTION public.get_analytics_daily_breakdown_v2(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_dayparting(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_dayparting_v2(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_heatmap(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_heatmap_v2(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_overview(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_overview_v2(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_performance(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_performance_v2(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_trends(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_trends_v2(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_analytics_unique_items_v2(uuid, date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.get_distinct_categories(uuid) SET search_path = public;
ALTER FUNCTION public.get_distinct_store_names(uuid) SET search_path = public;
ALTER FUNCTION public.get_endpoint_stats(integer) SET search_path = public;
ALTER FUNCTION public.get_hourly_metrics(integer) SET search_path = public;
ALTER FUNCTION public.get_item_exclusion_suggestions(uuid, date, date, text[], text[], integer, bigint, integer) SET search_path = public;
ALTER FUNCTION public.get_item_monthly_quadrants_v1(uuid, date, date, text[], text[], text) SET search_path = public;
ALTER FUNCTION public.get_item_totals_v2(uuid, date, date, text[], text[], text, boolean, boolean, integer, integer, integer, boolean) SET search_path = public;
ALTER FUNCTION public.get_or_create_alert_settings(uuid) SET search_path = public;
ALTER FUNCTION public.get_slow_endpoints(integer, integer) SET search_path = public;
ALTER FUNCTION public.get_tenant_health_stats() SET search_path = public;
ALTER FUNCTION public.get_transaction_summary(uuid, text, text) SET search_path = public;
ALTER FUNCTION public.get_watched_items_summary_v1(uuid, text[], date, date, text[], text[]) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.refresh_all_summaries(uuid) SET search_path = public;
ALTER FUNCTION public.refresh_branch_summaries(uuid) SET search_path = public;
ALTER FUNCTION public.refresh_hourly_summaries(uuid) SET search_path = public;
ALTER FUNCTION public.refresh_item_pairs(uuid, date, date, integer) SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
