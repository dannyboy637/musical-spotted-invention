# Operator Onboarding Checklist

> **Internal document** for onboarding new restaurant clients.
> Last updated: Phase 12 (Second Tenant Validation)

---

## Pre-Onboarding

- [ ] **Gather client information**
  - Restaurant name
  - Number of branches/locations
  - POS system (StoreHub, etc.)
  - Desired user accounts (owner email, any viewers)
  - Timezone (default: Asia/Manila)
  - Report recipient email

- [ ] **Request sample data**
  - Ask for 1-2 weeks of CSV exports to validate format
  - Confirm columns match expected StoreHub format
  - Check for any custom categories or items

---

## Phase 1: Tenant Setup

### 1.1 Create Tenant Record

Run in Supabase SQL Editor:

```sql
INSERT INTO public.tenants (name, slug, settings, is_active)
VALUES (
    'Restaurant Name',
    'restaurant-slug',
    '{
        "timezone": "Asia/Manila",
        "currency": "PHP",
        "branches": ["Branch 1", "Branch 2"]
    }'::jsonb,
    true
);
```

Note the generated `tenant_id` (UUID) for next steps.

### 1.2 Create Alert Settings

```sql
INSERT INTO public.alert_settings (tenant_id, revenue_drop_threshold, item_change_threshold, quadrant_change_enabled)
VALUES (
    '<tenant_id>',
    15.0,  -- 15% revenue drop threshold
    50.0,  -- 50% item change threshold
    true   -- Enable quadrant change detection
);
```

### 1.3 Set Report Recipient

```sql
UPDATE public.tenants
SET report_recipient_email = 'owner@restaurant.com'
WHERE id = '<tenant_id>';
```

---

## Phase 2: User Setup

### 2.1 Create Auth Users

In Supabase Dashboard > Authentication > Users:

1. Click "Add user" > "Create new user"
2. Enter email and password
3. Check "Auto Confirm User" (skip email verification)
4. Repeat for each user account

### 2.2 Assign Roles and Tenant

After auth users are created, run in SQL Editor:

```sql
-- Owner account
UPDATE public.users
SET role = 'owner', tenant_id = '<tenant_id>', full_name = 'Owner Name'
WHERE email = 'owner@restaurant.com';

-- Viewer accounts (if any)
UPDATE public.users
SET role = 'viewer', tenant_id = '<tenant_id>', full_name = 'Staff Name'
WHERE email = 'staff@restaurant.com';
```

### 2.3 Verify User Setup

```sql
SELECT email, role, tenant_id, full_name
FROM public.users
WHERE tenant_id = '<tenant_id>';
```

---

## Phase 3: Data Import

### 3.1 Prepare CSV Data

1. Receive CSV exports from client
2. Verify required columns present:
   - Receipt Number
   - Time (timestamp)
   - Store (branch name)
   - Item
   - Category
   - Quantity
   - SubTotal
   - Tax
   - Discount (optional)
   - Service Charge

### 3.2 Import via CLI

```bash
cd backend
source venv/bin/activate
python scripts/import_storehub.py \
    --tenant-id <tenant_id> \
    --file /path/to/data.csv
```

### 3.3 Verify Import

Check in SQL Editor:

```sql
-- Transaction count
SELECT COUNT(*) FROM transactions WHERE tenant_id = '<tenant_id>';

-- Date range
SELECT MIN(receipt_timestamp), MAX(receipt_timestamp)
FROM transactions WHERE tenant_id = '<tenant_id>';

-- Branch distribution
SELECT store_name, COUNT(*) as count
FROM transactions
WHERE tenant_id = '<tenant_id>'
GROUP BY store_name;
```

---

## Phase 4: Validation

### 4.1 Dashboard Verification

Login as the owner account and verify:

- [ ] Executive Dashboard shows data
- [ ] KPIs calculate correctly
- [ ] Branch filter shows all branches
- [ ] Date range picker works
- [ ] Revenue trends chart populated

### 4.2 Module Checks

- [ ] Menu Engineering scatter plot populated
- [ ] Time Intelligence heatmap shows patterns
- [ ] Performance trends display
- [ ] Branch comparison works
- [ ] Categories breakdown correct
- [ ] Recommendations generate

### 4.3 Alert System

- [ ] Run manual alert scan
- [ ] Verify alert settings accessible
- [ ] Test threshold configuration

---

## Phase 5: Client Handoff

### 5.1 Send Welcome Email

Include:
- Login URL: `https://your-domain.com`
- Email and temporary password
- Link to Client Welcome Guide
- Your contact for support

### 5.2 Schedule Onboarding Call (Optional)

- 15-30 minute walkthrough
- Show key dashboard features
- Explain weekly reports
- Answer questions

### 5.3 Enable Scheduled Reports

1. Generate first weekly report manually
2. Review and edit AI narrative
3. Approve and send
4. Confirm receipt

---

## Troubleshooting

### User can't login
1. Check auth.users table for the email
2. Verify public.users record exists with correct tenant_id
3. Reset password if needed

### No data showing
1. Check transactions exist for tenant
2. Verify date range filter isn't excluding data
3. Check RLS policies aren't blocking

### Alerts not triggering
1. Verify alert_settings record exists
2. Check thresholds aren't too strict
3. Ensure enough historical data for comparison

---

## Checklist Template

Copy this for each new client:

```
# [Restaurant Name] Onboarding

## Status: [ ] Pre / [ ] Setup / [ ] Import / [ ] Verify / [ ] Live

Tenant ID:
Owner Email:
Start Date:

### Tasks
- [ ] Tenant created
- [ ] Users created
- [ ] Data imported (X rows)
- [ ] Dashboard verified
- [ ] Welcome email sent
- [ ] First report sent
```
