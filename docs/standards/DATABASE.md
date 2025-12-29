# Database Standards (Supabase/PostgreSQL)

## Table Naming
- Plural, snake_case: `users`, `transactions`, `menu_items`

## Column Naming
- snake_case: `tenant_id`, `created_at`, `is_active`

## Required Columns
Every table should have:
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
created_at timestamptz DEFAULT now()
```

Tenant tables also need:
```sql
tenant_id uuid REFERENCES tenants(id) NOT NULL
```

## RLS Policies

```sql
-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy for tenant users
CREATE POLICY "tenant_isolation" ON transactions
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Policy for operators (can see all)
CREATE POLICY "operator_access" ON transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'operator'
    )
  );
```

## Indexes

```sql
-- Always index tenant_id
CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);

-- Index common query patterns
CREATE INDEX idx_transactions_tenant_date 
  ON transactions(tenant_id, timestamp);
```

## Migrations

Keep migration files in `supabase/migrations/`:
```
20241230_create_tenants.sql
20241230_create_users.sql
20241231_create_transactions.sql
```
