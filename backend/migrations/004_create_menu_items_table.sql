-- Migration: Create menu_items table (aggregated analytics)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER 003_create_transactions_table.sql

-- ============================================
-- 1. CREATE MENU_ITEMS TABLE
-- ============================================

CREATE TABLE public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Item identification
    item_name TEXT NOT NULL,
    category TEXT,
    macro_category TEXT,

    -- Aggregated metrics (money in cents)
    total_quantity INTEGER NOT NULL DEFAULT 0,
    total_gross_revenue INTEGER NOT NULL DEFAULT 0,
    avg_price INTEGER NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,

    -- Time-based metrics
    first_sale_date DATE NOT NULL,
    last_sale_date DATE NOT NULL,
    months_active INTEGER NOT NULL DEFAULT 0,
    days_since_last_sale INTEGER NOT NULL DEFAULT 0,

    -- Classification
    is_core_menu BOOLEAN DEFAULT FALSE,
    is_current_menu BOOLEAN DEFAULT FALSE,
    is_excluded BOOLEAN DEFAULT FALSE,
    quadrant TEXT,

    -- Metadata
    last_aggregated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint per tenant/item
    CONSTRAINT menu_items_tenant_item_unique UNIQUE (tenant_id, item_name)
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

CREATE INDEX idx_menu_items_tenant ON public.menu_items(tenant_id);
CREATE INDEX idx_menu_items_category ON public.menu_items(category);
CREATE INDEX idx_menu_items_macro_category ON public.menu_items(macro_category);
CREATE INDEX idx_menu_items_quadrant ON public.menu_items(quadrant);
CREATE INDEX idx_menu_items_is_core ON public.menu_items(is_core_menu);
CREATE INDEX idx_menu_items_is_current ON public.menu_items(is_current_menu);

-- ============================================
-- 3. ENABLE RLS
-- ============================================

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS POLICIES
-- ============================================

-- Users can view their own tenant's menu items
CREATE POLICY "Users can view own tenant menu items" ON public.menu_items
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Operators can manage all menu items
CREATE POLICY "Operators can manage menu items" ON public.menu_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'operator')
    );

-- Owners can manage their own tenant's menu items
CREATE POLICY "Owners can manage own tenant menu items" ON public.menu_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'owner'
            AND tenant_id = menu_items.tenant_id
        )
    );

-- ============================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================

-- Uses existing update_updated_at() function from 001_create_users_table.sql
CREATE TRIGGER update_menu_items_updated_at
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
