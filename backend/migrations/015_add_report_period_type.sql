-- Migration: Add period_type column to reports table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 014_add_tenant_report_email.sql

-- ============================================
-- 1. ADD PERIOD_TYPE COLUMN
-- ============================================

ALTER TABLE public.reports
ADD COLUMN period_type TEXT NOT NULL DEFAULT 'week';

-- ============================================
-- 2. ADD COMMENT
-- ============================================

COMMENT ON COLUMN public.reports.period_type IS
    'Report period type: week, month, quarter, year';
