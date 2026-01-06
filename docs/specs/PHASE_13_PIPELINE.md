# Phase 13: V2 Feature Pipeline

This document outlines planned features for the next major version of the restaurant analytics platform.

---

## 1. Full Preferences System (Database Sync)

### Overview
Migrate settings from localStorage to a database-backed system for cross-device sync.

### Database Schema
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_date_range TEXT DEFAULT 'all',
  enabled_kpis TEXT[] DEFAULT ARRAY['revenue', 'transactions', 'avgTicket', 'uniqueItems'],
  number_format TEXT DEFAULT 'us',
  theme TEXT DEFAULT 'system',
  table_rows_per_page INTEGER DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);
```

### API Endpoints
```
GET  /api/user/settings     - Get current user's settings
PUT  /api/user/settings     - Update current user's settings
```

### Migration Strategy
1. On first login after upgrade, check localStorage for existing settings
2. If found, migrate to database and clear localStorage
3. Fall back to defaults if neither exists

---

## 2. Saved Filter Presets

### Overview
Allow users to save and quickly apply filter combinations.

### Example Presets
- "Weekend Analysis" - Saturday + Sunday, all branches
- "Lunch Rush" - 11am-2pm daypart filter
- "Branch A Performance" - specific branch only

### Database Schema
```sql
CREATE TABLE filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_range_type TEXT, -- 'relative' or 'absolute'
  date_range_value JSONB, -- {days: 7} or {start: '2024-01-01', end: '2024-01-31'}
  branches TEXT[],
  categories TEXT[],
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### UI
- Save icon next to GlobalFilters
- Dropdown to select/manage presets
- Star icon to set default preset

---

## 3. Dashboard Layout Customization

### Overview
Let users show/hide and reorder dashboard modules.

### Configurable Elements
- KPI cards visibility and order
- Chart widgets (show/hide/reorder)
- Quick links section
- Module-specific settings (e.g., chart type preferences)

### Implementation
- Drag-and-drop grid layout (react-grid-layout)
- Store layout in user_settings as JSON
- Reset to default option

---

## 4. Alert System

### Types of Alerts
1. **Revenue Alerts**
   - Daily revenue below threshold
   - Significant drop compared to same day last week

2. **Inventory Alerts** (future)
   - Low stock warnings
   - Items approaching expiry

3. **Performance Anomalies**
   - Unusual sales patterns
   - Transaction volume spikes/drops

### Delivery Channels
- In-app notifications (bell icon in header)
- Email notifications (daily digest or immediate)
- Push notifications (future)

### Database Schema
```sql
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by UUID NOT NULL REFERENCES users(id),
  rule_type TEXT NOT NULL, -- 'revenue_threshold', 'revenue_drop', 'anomaly'
  config JSONB NOT NULL, -- rule-specific configuration
  is_active BOOLEAN DEFAULT TRUE,
  notify_email BOOLEAN DEFAULT TRUE,
  notify_in_app BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Scheduled Reports

### Overview
Automated email reports sent on a schedule.

### Report Types
- Executive Summary (daily/weekly)
- Menu Performance Report (weekly)
- Branch Comparison (weekly/monthly)
- Custom report builder (future)

### Schedule Options
- Daily (morning summary)
- Weekly (Monday morning)
- Monthly (1st of month)
- Custom cron expression (advanced)

### Implementation
- Backend cron job (APScheduler or Celery)
- PDF generation (WeasyPrint or Puppeteer)
- Email delivery (SendGrid, SES, or Resend)

---

## 6. Advanced Date Comparisons

> **Partially Implemented (Jan 2025):**
> - Year-over-Year comparison added to Time Intelligence page (`/api/analytics/year-over-year`)
> - Day-of-Week same-day comparison added (`/api/analytics/day-of-week`)
> - Remaining: Previous period toggle, same day last week/month, custom ranges

### Comparison Modes
- Previous period (automatic)
- Same day last week
- Same day last month
- ~~Same day last year~~ ✅ **DONE** - YearOverYearChart in Time Intelligence
- Custom comparison range

### UI
- Toggle to show comparison data on charts
- Percentage change indicators
- Side-by-side tables

---

## 7. Multi-Tenant Dashboard (Operators)

### Overview
Consolidated view across all tenant portfolios for operators.

### Features
- Portfolio-level KPIs (total revenue across tenants)
- Tenant performance ranking
- Quick tenant switching
- Cross-tenant benchmarking

### Performance Considerations
- Aggregate data cached at portfolio level
- Incremental updates vs full recalculation
- Rate limiting per tenant

---

## 8. White-Label Branding

### Customization Options
- Logo upload (header, login page)
- Primary color override
- Custom domain (CNAME)
- Email template branding
- Footer text customization

### Database Schema
```sql
ALTER TABLE tenants ADD COLUMN branding JSONB DEFAULT '{}'::jsonb;

-- Example branding object:
-- {
--   "logo_url": "https://...",
--   "primary_color": "#1a5f7a",
--   "company_name": "Spotted Pig Analytics",
--   "email_footer": "Powered by Restaurant Analytics"
-- }
```

---

## 9. Export Preferences

### Configurable Export Options
- Default export format (CSV, Excel, PDF)
- Included columns per report type
- Date format preference
- Currency display format

### Scheduled Exports
- Auto-export to cloud storage (S3, Google Drive)
- SFTP delivery for enterprise clients

---

## 10. Custom KPI Formulas

### Overview
Allow users to define calculated metrics.

### Example Formulas
- `avg_items_per_transaction = unique_items / total_transactions`
- `beverage_ratio = beverage_revenue / total_revenue * 100`
- `lunch_contribution = lunch_revenue / total_revenue * 100`

### Implementation
- Safe expression parser (no eval)
- Validation against available fields
- Preview with sample data

---

## 11. Revenue Reconciliation & Daily Breakdown

### Overview
Ensure revenue figures match StoreHub exactly by properly handling tax, discounts, and service charges. Add a daily breakdown table to Dashboard and Performance pages for quick overview.

### Problem Statement
Current revenue calculations may not match StoreHub reports due to:
- Tax handling differences
- Discount calculation methods
- Service charge allocation
- Net vs Gross revenue confusion

### Revenue Definitions (StoreHub Aligned)
```
Gross Sales      = Sum of all item prices before discounts
Discounts        = Total discount amount (negative value)
Net Sales        = Gross Sales - Discounts
Tax              = VAT/Sales tax collected
Service Charge   = Service fee (usually 10%)
Total Revenue    = Net Sales + Tax + Service Charge
Gross Profit     = Net Sales - Cost of Goods Sold (COGS)
```

### Daily Breakdown Table Component

**Location:** Dashboard page + Performance page

**UI Design:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Daily Breakdown                                                    [Export CSV] │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Tabs: [Net Sales] [Tax] [Service Charge] [Discounts] [Gross Profit]            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Date / Time ▲     │ Amount (₱)    │ Transactions │ Discount (₱) │ Discount %  │
├────────────────────┼───────────────┼──────────────┼──────────────┼─────────────┤
│  1 Dec 2025 (Mon)  │   266,011.78  │     308      │    8,298.98  │    3.54%    │
│  2 Dec 2025 (Tue)  │   256,265.38  │     282      │    5,380.44  │    2.42%    │
│  3 Dec 2025 (Wed)  │   150,786.20  │     164      │    3,723.63  │    2.82%    │
│  ...               │               │              │              │             │
├────────────────────┼───────────────┼──────────────┼──────────────┼─────────────┤
│  Total             │ 10,413,510.41 │    8,319     │  327,036.61  │    3.58%    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Tab Columns:**
| Tab | Columns |
|-----|---------|
| Net Sales | Date, Net Sales, Transactions, Avg Check |
| Tax | Date, Tax Amount, Tax %, Transactions |
| Service Charge | Date, SC Amount, SC %, Transactions |
| Discounts | Date, Net Sales, Discount Amount, Discount % |
| Gross Profit | Date, Net Sales, COGS, Gross Profit, GP % |

### Backend API

**New Endpoint:**
```
GET /api/analytics/daily-breakdown
```

**Query Parameters:**
- `start_date`, `end_date` (required)
- `branches` (optional, comma-separated)
- `categories` (optional, comma-separated)
- `metric` (optional): `net_sales` | `tax` | `service_charge` | `discounts` | `gross_profit`

**Response:**
```json
{
  "rows": [
    {
      "date": "2025-12-01",
      "day_name": "Mon",
      "net_sales": 266011.78,
      "gross_sales": 274310.76,
      "tax": 31921.41,
      "service_charge": 26601.18,
      "discounts": 8298.98,
      "discount_percent": 3.54,
      "transactions": 308,
      "avg_check": 863.67,
      "cogs": null,  // null if costs not entered
      "gross_profit": null,
      "gross_profit_percent": null
    }
  ],
  "totals": {
    "net_sales": 10413510.41,
    "gross_sales": 10740547.02,
    "tax": 1249621.25,
    "service_charge": 1041351.04,
    "discounts": 327036.61,
    "discount_percent": 3.58,
    "transactions": 8319,
    "avg_check": 1251.78,
    "cogs": null,
    "gross_profit": null,
    "gross_profit_percent": null
  }
}
```

### Database Changes

**Verify transactions table has:**
```sql
-- Already exists, verify values are correct:
subtotal        -- Item price after line-level discounts
tax             -- Tax amount
service_charge  -- Allocated service charge per item
discount        -- Receipt-level discount allocation
gross_revenue   -- Total amount (subtotal + tax + sc + discount)
```

**May need migration to add:**
```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gross_sales DECIMAL(12,2);
-- gross_sales = subtotal before any discounts applied
```

### Frontend Components

**New Components:**
- `DailyBreakdownTable.tsx` - Main table component with tabs
- `DailyBreakdownRow.tsx` - Table row component
- `useAnalytics.ts` - Add `useDailyBreakdown()` hook

**Integration:**
1. Add to `DashboardPage.tsx` below KPI cards
2. Add to `PerformancePage.tsx` as first section
3. Collapsible by default on mobile

### Acceptance Criteria

- [ ] Revenue figures match StoreHub dashboard exactly
- [ ] Daily breakdown table shows all days in selected range
- [ ] Tabs switch between different metrics
- [ ] Totals row shows period sums/averages
- [ ] Sortable by date (asc/desc)
- [ ] Export to CSV works
- [ ] Mobile responsive (horizontal scroll)
- [ ] Loading skeleton while fetching

### Implementation Steps

1. **Audit current revenue calculation** - Compare with StoreHub export
2. **Fix any discrepancies** - Update `transform_storehub_row()` if needed
3. **Create backend endpoint** - `/api/analytics/daily-breakdown`
4. **Create frontend component** - `DailyBreakdownTable`
5. **Integrate into Dashboard** - Add below KPIs
6. **Integrate into Performance** - Add as first section
7. **Add CSV export** - Download button
8. **Test against StoreHub** - Verify numbers match

---

## Priority Order

| Priority | Feature | Complexity | Impact |
|----------|---------|------------|--------|
| **0** | **Revenue Reconciliation & Daily Breakdown** | **Medium** | **Critical** |
| 1 | Full Preferences System | Medium | High |
| 2 | Saved Filter Presets | Low | High |
| 3 | Alert System | High | High |
| 4 | Scheduled Reports | Medium | High |
| 5 | Advanced Date Comparisons | Medium | Medium |
| 6 | Dashboard Customization | High | Medium |
| 7 | Multi-Tenant Dashboard | Medium | Medium |
| 8 | Export Preferences | Low | Low |
| 9 | White-Label Branding | Medium | Low |
| 10 | Custom KPI Formulas | High | Low |

---

## Timeline Estimates

These are rough estimates, not commitments:

- **Q1**: Preferences sync, Filter presets
- **Q2**: Alert system, Scheduled reports
- **Q3**: Date comparisons, Dashboard customization
- **Q4**: Multi-tenant, Export preferences
- **Future**: White-label, Custom formulas

---

## Technical Considerations

### Performance
- Implement Redis caching for cross-device settings sync
- Consider read replicas for report generation
- Background job queue for heavy operations

### Security
- Rate limiting on API endpoints
- Input validation for custom formulas
- Audit logging for settings changes

### Scalability
- Horizontal scaling for report workers
- CDN for static assets
- Database connection pooling
