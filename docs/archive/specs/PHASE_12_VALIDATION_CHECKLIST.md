# Phase 12: Validation Checklist

> Use this checklist to verify multi-tenant isolation and module functionality.

---

## Test Credentials

| User | Email | Role | Tenant |
|------|-------|------|--------|
| Demo Owner | demo-owner@test.com | owner | Demo Restaurant |
| Demo Viewer | demo-viewer@test.com | viewer | Demo Restaurant |
| Operator | (your operator account) | operator | All tenants |

Password for test accounts: `DemoTest123!`

---

## 1. Setup Verification

Run the scripts in order:

```bash
cd backend
source venv/bin/activate

# 1. Create tenant and users
python scripts/setup_demo_tenant.py

# 2. Generate demo data
python scripts/generate_demo_data.py --months 18

# 3. Import the data
python scripts/import_storehub.py \
    --tenant-id a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
    --file demo_data.csv

# 4. Run isolation verification
python scripts/verify_data_isolation.py
```

### Setup Checklist

- [ ] Tenant "Demo Restaurant" created
- [ ] demo-owner@test.com user created (owner role)
- [ ] demo-viewer@test.com user created (viewer role)
- [ ] 18 months of demo data generated
- [ ] Data imported successfully (check row count)
- [ ] Isolation verification script passes

---

## 2. Data Isolation Tests

### 2.1 Login as Demo Owner

- [ ] Can login successfully
- [ ] Sees "Demo Restaurant" in header
- [ ] Cannot switch tenants (no switcher visible)
- [ ] Dashboard shows Demo Restaurant data only

### 2.2 Login as Original Tenant Owner

- [ ] Can login successfully
- [ ] Sees original tenant name in header
- [ ] Dashboard shows only their data
- [ ] Revenue totals differ from Demo Restaurant

### 2.3 Login as Operator

- [ ] Can login successfully
- [ ] Tenant switcher visible
- [ ] Can switch to Demo Restaurant
- [ ] Can switch back to original tenant
- [ ] Data changes when switching tenants

### 2.4 Overlapping Data Tests

- [ ] Both tenants have items named "Fried Rice"
- [ ] "Fried Rice" stats differ between tenants
- [ ] Same-date queries return different data per tenant
- [ ] No branch names appear in wrong tenant

---

## 3. Module Validation (Demo Restaurant)

Login as demo-owner@test.com for these tests.

### 3.1 Executive Dashboard

- [ ] Page loads without errors
- [ ] 4 KPI cards populated (Revenue, Transactions, Avg Check, Top Category)
- [ ] Revenue trend chart shows data
- [ ] Top items list populated
- [ ] Date range picker works
- [ ] Branch filter shows 5 Demo branches
- [ ] Category filter shows menu categories

### 3.2 Menu Engineering

- [ ] Scatter plot renders
- [ ] Items distributed across quadrants
- [ ] Quadrant filter buttons work
- [ ] Click on item shows details panel
- [ ] Item details show correct trends
- [ ] Zoom/pan functionality works

### 3.3 Time Intelligence

- [ ] Daypart chart shows 4 time periods
- [ ] Hourly heatmap renders (day x hour grid)
- [ ] Day of week chart populated
- [ ] Year-over-year comparison works (if 12+ months data)
- [ ] Filters apply to all charts

### 3.4 Performance Analytics

- [ ] Trend chart renders
- [ ] Daily/Weekly/Monthly toggles work
- [ ] Moving averages display (7-day, 4-week options)
- [ ] Growth metrics calculated
- [ ] Date range changes update chart

### 3.5 Branch Comparison

- [ ] All 5 Demo branches listed
- [ ] Revenue and transaction counts shown
- [ ] Average check values displayed
- [ ] Top items per branch listed
- [ ] Sorting works

### 3.6 Categories

- [ ] All categories from demo data shown
- [ ] Revenue breakdown by category
- [ ] Category trends display
- [ ] Click category shows item details
- [ ] Donut chart renders correctly

### 3.7 Recommendations

- [ ] Rule-based suggestions generate
- [ ] Bundle analysis shows item pairs
- [ ] Period selector works (Last Week/Month/Quarter/Year)
- [ ] Period selection overrides global filters

### 3.8 Cost Management

- [ ] Cost input form accessible
- [ ] Can enter/update item costs
- [ ] Bulk import available
- [ ] Margin calculations update after cost entry

### 3.9 Data Management

- [ ] Import history shows demo import
- [ ] Transaction viewer loads data
- [ ] Can filter transactions
- [ ] Row counts match expected

### 3.10 Alerts

- [ ] Alert list page loads
- [ ] Can run manual scan
- [ ] Alert settings accessible
- [ ] Thresholds can be adjusted
- [ ] AlertBanner appears on dashboard (if alerts exist)

---

## 4. Role Permission Tests

### 4.1 Owner Permissions (demo-owner@test.com)

- [ ] Can view all dashboard modules
- [ ] Can dismiss alerts
- [ ] Can modify alert settings
- [ ] Can access Settings modal
- [ ] Cannot access Report Center (operator only)
- [ ] Cannot switch tenants

### 4.2 Viewer Permissions (demo-viewer@test.com)

- [ ] Can view all dashboard modules
- [ ] Cannot dismiss alerts (button disabled or hidden)
- [ ] Cannot modify alert settings (form disabled)
- [ ] Can access Settings modal (read-only preferences)
- [ ] Cannot access Report Center
- [ ] Cannot access Cost Management input form

### 4.3 Operator Permissions

- [ ] Can view all dashboard modules
- [ ] Can switch tenants
- [ ] Can access Report Center
- [ ] Can generate/edit/send reports
- [ ] Can access all tenants' data

---

## 5. Reports Validation (Operator Only)

### 5.1 Generate Demo Restaurant Report

- [ ] Navigate to Report Center
- [ ] Select Demo Restaurant tenant
- [ ] Generate Weekly report
- [ ] Report shows Demo Restaurant data only
- [ ] KPIs calculate correctly
- [ ] Top items list populated
- [ ] Movers section shows changes

### 5.2 Report Workflow

- [ ] Can edit AI narrative
- [ ] Can regenerate narrative
- [ ] Can approve report
- [ ] Can preview before sending
- [ ] Send works (mock mode)

---

## 6. Edge Case Tests

### 6.1 Empty States

- [ ] New tenant with no data shows empty states
- [ ] Empty state messages are helpful
- [ ] CTA buttons work (link to import)

### 6.2 Error Handling

- [ ] Invalid date range shows error
- [ ] Network error shows toast
- [ ] 404 page works
- [ ] Unauthorized access redirects to login

### 6.3 Performance

- [ ] Dashboard loads in < 3 seconds
- [ ] Charts render smoothly
- [ ] No memory leaks on navigation
- [ ] Large date ranges don't timeout

---

## 7. Final Verification

### 7.1 Cross-Check Data Totals

| Metric | Original Tenant | Demo Restaurant |
|--------|-----------------|-----------------|
| Transactions | ___________ | ___________ |
| Revenue (PHP) | ___________ | ___________ |
| Branches | ___________ | 5 |
| Items | ___________ | ___________ |

### 7.2 Sign-Off

- [ ] All module tests passed
- [ ] All role tests passed
- [ ] No data leakage found
- [ ] Performance acceptable

**Tested by:** _______________
**Date:** _______________
**Notes:** _______________

---

## Issues Found

| # | Module | Description | Severity | Status |
|---|--------|-------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

*Phase 12 complete when all acceptance criteria checked.*
