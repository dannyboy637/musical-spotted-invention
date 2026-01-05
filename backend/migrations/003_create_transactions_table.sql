-- Migration: Create transactions table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 002_create_tenants_table.sql

-- ============================================
-- 1. CREATE TRANSACTIONS TABLE
-- ============================================

CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Receipt identification
    receipt_number TEXT NOT NULL,
    receipt_timestamp TIMESTAMPTZ NOT NULL,

    -- Item details
    item_name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,

    -- Pricing (all in PHP cents to avoid floating point issues)
    unit_price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    discount INTEGER DEFAULT 0,
    tax INTEGER DEFAULT 0,
    allocated_service_charge INTEGER DEFAULT 0,
    gross_revenue INTEGER NOT NULL,

    -- Derived/enriched fields (populated during import)
    macro_category TEXT,
    is_excluded BOOLEAN DEFAULT FALSE,

    -- Metadata
    import_batch_id UUID,
    source_file TEXT,
    source_row_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate imports
    CONSTRAINT transactions_unique_row UNIQUE (tenant_id, receipt_number, item_name, source_row_number)
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

CREATE INDEX idx_transactions_tenant ON public.transactions(tenant_id);
CREATE INDEX idx_transactions_timestamp ON public.transactions(receipt_timestamp);
CREATE INDEX idx_transactions_category ON public.transactions(category);
CREATE INDEX idx_transactions_macro_category ON public.transactions(macro_category);
CREATE INDEX idx_transactions_tenant_timestamp ON public.transactions(tenant_id, receipt_timestamp);
CREATE INDEX idx_transactions_item_name ON public.transactions(item_name);
CREATE INDEX idx_transactions_import_batch ON public.transactions(import_batch_id);

-- ============================================
-- 3. ENABLE RLS
-- ============================================

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS POLICIES
-- ============================================

-- Users can view their own tenant's transactions
CREATE POLICY "Users can view own tenant transactions" ON public.transactions
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Operators can insert transactions (for any tenant)
CREATE POLICY "Operators can insert transactions" ON public.transactions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Owners can insert transactions for their own tenant
CREATE POLICY "Owners can insert own tenant transactions" ON public.transactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'owner'
            AND tenant_id = transactions.tenant_id
        )
    );

-- Operators can delete transactions
CREATE POLICY "Operators can delete transactions" ON public.transactions
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Owners can delete their own tenant's transactions
CREATE POLICY "Owners can delete own tenant transactions" ON public.transactions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'owner'
            AND tenant_id = transactions.tenant_id
        )
    );

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, DELETE ON public.transactions TO authenticated;
