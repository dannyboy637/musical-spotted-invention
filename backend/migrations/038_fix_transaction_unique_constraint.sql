-- Migration 038: Fix transaction unique constraint for duplicate prevention
-- The old constraint included source_row_number, which changes between imports
-- New constraint uses receipt_timestamp instead for proper deduplication

-- Step 1: Drop the old constraint
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_tenant_id_receipt_number_item_name_source_row__key;

-- Step 2: Delete duplicate transactions (keep the oldest by id)
-- A duplicate is defined as same tenant_id + receipt_number + item_name + receipt_timestamp
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY tenant_id, receipt_number, item_name, receipt_timestamp
               ORDER BY id ASC
           ) as rn
    FROM transactions
)
DELETE FROM transactions
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Step 3: Create new unique constraint (without source_row_number)
ALTER TABLE transactions
ADD CONSTRAINT transactions_unique_receipt_item
UNIQUE (tenant_id, receipt_number, item_name, receipt_timestamp);

-- Step 4: Create index for faster lookups on the new constraint columns
CREATE INDEX IF NOT EXISTS idx_transactions_dedup
ON transactions (tenant_id, receipt_number, item_name, receipt_timestamp);

-- Log how many duplicates were removed
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Migration 038: Duplicate constraint fixed';
END $$;
