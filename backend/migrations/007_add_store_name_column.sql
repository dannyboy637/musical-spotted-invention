-- Migration: Add store_name column to transactions
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER existing transactions table exists

-- ============================================
-- 1. ADD STORE_NAME COLUMN
-- ============================================

ALTER TABLE public.transactions ADD COLUMN store_name TEXT;

-- ============================================
-- 2. CREATE INDEX FOR FILTERING
-- ============================================

CREATE INDEX idx_transactions_store ON public.transactions(store_name);

-- ============================================
-- NOTES
-- ============================================
-- The store_name column captures the branch/location from StoreHub's "Store" column.
-- Example values: "Spotted Pig Cafe - Legazpi", "Spotted Pig Cafe - Proscenium"
-- After running this migration, re-import CSV data to populate the column.
