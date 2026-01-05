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

## Priority Order

| Priority | Feature | Complexity | Impact |
|----------|---------|------------|--------|
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
