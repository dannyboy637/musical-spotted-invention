-- Migration: Add report recipient email to tenants table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 013_create_reports_table.sql

-- ============================================
-- 1. ADD REPORT_RECIPIENT_EMAIL COLUMN
-- ============================================

ALTER TABLE public.tenants
ADD COLUMN report_recipient_email TEXT;

-- ============================================
-- 2. ADD REPORT SCHEDULE SETTINGS (optional future use)
-- ============================================

-- These could be used later for per-tenant schedule customization
-- For now, all tenants use global schedule (Monday 8am Manila)

COMMENT ON COLUMN public.tenants.report_recipient_email IS
    'Email address to send weekly reports to. Set by operator.';
