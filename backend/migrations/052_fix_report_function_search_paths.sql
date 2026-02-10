-- Migration 052: Fix search_path on 3 report functions created after migration 048
-- These were added in migrations 049/050 without SET search_path.
-- Resolves remaining "Function Search Path Mutable" security advisor warnings.

ALTER FUNCTION public.get_report_top_items SET search_path = public;
ALTER FUNCTION public.get_report_movers SET search_path = public;
ALTER FUNCTION public.get_category_by_branch_agg SET search_path = public;
