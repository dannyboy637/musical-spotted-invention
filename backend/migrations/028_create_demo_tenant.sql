-- Migration: Create Demo Restaurant tenant for Phase 12 validation
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- IMPORTANT: Run this AFTER all previous migrations

-- ============================================
-- 1. INSERT DEMO RESTAURANT TENANT
-- ============================================

INSERT INTO public.tenants (id, name, slug, settings, is_active)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Demo Restaurant',
    'demo-restaurant',
    '{
        "timezone": "Asia/Manila",
        "currency": "PHP",
        "branches": ["Main Branch", "Downtown", "Mall Outlet", "Airport", "University"]
    }'::jsonb,
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    settings = EXCLUDED.settings,
    is_active = true;

-- ============================================
-- 2. INSERT DEFAULT ALERT SETTINGS
-- ============================================

INSERT INTO public.alert_settings (tenant_id, revenue_drop_threshold, item_change_threshold, quadrant_change_enabled)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    15.0,  -- 15% revenue drop threshold
    50.0,  -- 50% item change threshold
    true   -- Enable quadrant change detection
)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================
-- 3. NOTES
-- ============================================
-- After running this migration:
-- 1. Create test users in Supabase Auth dashboard:
--    - demo-owner@test.com (with password)
--    - demo-viewer@test.com (with password)
-- 2. Update users table with roles and tenant assignment:
--    Run the UPDATE statements below after auth users are created.

-- ============================================
-- 4. USER UPDATES (run after auth user creation)
-- ============================================

-- Uncomment and run after creating auth users:
-- UPDATE public.users SET role = 'owner', tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- WHERE email = 'demo-owner@test.com';

-- UPDATE public.users SET role = 'viewer', tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- WHERE email = 'demo-viewer@test.com';
