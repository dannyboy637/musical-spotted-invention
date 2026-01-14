# Changelog

All notable changes to this project will be documented in this file.

---

## [1.1.0] - 2026-01-14

### Bug Fixes

- **#1 Top items by branch missing names** - Fixed SQL field name mismatch in `get_analytics_branches_v2` RPC function (item_name → item)
- **#2 Settings default date range not saving** - Fixed useEffect dependencies for date range hydration; now applies immediately when changed
- **#3 Bundle opportunities text truncation** - Added title attribute for tooltip on truncated recommendation titles
- **#18 Data range display showing wrong dates** - Data Range now shows full date range from all transactions, not just last import
- **#19 Worst day shows incomplete recent days** - Added "May have incomplete data" warning when worst day is within last 2 days

### New Features

- **#4 "All Time" date range option** - Added "All Time" to date picker presets for viewing complete data history
- **#23 Alert multi-select and bulk dismiss** - Added checkboxes for multi-select, "Select All" toggle, and "Dismiss X selected" button for bulk operations

### Enhancements

- **#5 Remove duplicate settings button** - Cleaned up duplicate settings button from header
- **#6 Hide irrelevant filters** - Branch filter hidden on Branches page; Category filter hidden on Categories page; Info message on Menu Engineering (restaurant-wide view)
- **#7 Standardize alert colors** - Type-aware alert coloring with consistent color scheme (red=critical, amber=warning, green=success, blue=info)
- **#8 Standardize color usage** - Consistent color palette usage across recommendation cards
- **#11 Best day tooltip** - Added tooltip explaining Best Day KPI metric
- **#12 KPI info tooltips** - Added informational tooltips to all dashboard KPIs explaining what each metric represents

### Technical Improvements

- Added `date_range` field to backend `/data/health` endpoint
- Added `note` prop to StatCard component for contextual warnings
- Added `tooltip` prop to KPICard component

---

## [1.0.0] - 2026-01-07

Initial production release.

### Features
- Multi-tenant restaurant analytics platform
- Dashboard with KPIs (revenue, transactions, avg ticket, growth)
- Menu Engineering (BCG matrix quadrant analysis)
- Time Intelligence (dayparting, heatmap, day-of-week, YoY)
- Performance trends with moving averages
- Branch comparison
- Category breakdown
- Recommendations with bundle analysis
- Alerts & anomaly detection system
- Weekly/Monthly/Quarterly reports
- StoreHub CSV import with auto-sync
- Role-based access (operator, owner, viewer)

---

## Remaining Open Issues

| # | Title | Priority | Effort |
|---|-------|----------|--------|
| 17 | Fix cron job auto fetch | High | Medium |
| 18 | Theme/Dark Mode not working | - | Medium |
| 9 | Revenue Reconciliation + Daily Breakdown | High | Large |
| 10 | PDF export for any dashboard page | High | Large |
| 13 | Tooltips for chart axes and legends | Low | Medium |
| 14 | Day deep dive feature | Low | Large |
| 15 | Watch list / Item monitoring | Low | Large |
| 16 | README screenshots | Low | Small |
| 21 | Item Exclusion/Filtering System | - | Large |
| 22 | Restructure Alerts System | - | Large |
| 24 | Historical Movement Dashboard (YoY) | - | Large |
