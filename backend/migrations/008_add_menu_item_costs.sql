-- Migration 008: Add cost fields to menu_items for future owner input
-- Run this in Supabase SQL Editor

-- Add cost tracking columns
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cost_cents INTEGER;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cost_percentage DECIMAL(5,2);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS target_margin DECIMAL(5,2);

-- Add comments for documentation
COMMENT ON COLUMN menu_items.cost_cents IS 'Actual cost per unit in cents (PHP). Set by owner.';
COMMENT ON COLUMN menu_items.cost_percentage IS 'Cost as percentage of price (e.g., 30.00 = 30%). Set by owner.';
COMMENT ON COLUMN menu_items.target_margin IS 'Target profit margin percentage. Set by owner.';

-- Create index for cost analysis queries
CREATE INDEX IF NOT EXISTS idx_menu_items_cost_percentage ON menu_items(cost_percentage) WHERE cost_percentage IS NOT NULL;
