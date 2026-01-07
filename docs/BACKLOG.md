# Backlog

> Organized list of bugs, enhancements, and features.
> Last updated: 2026-01-08

---

## BUGS (Fix ASAP)

| # | Issue | Labels | Details |
|---|-------|--------|---------|
| B1 | Top items by branch not showing item names | `bug` `priority: high` | Only quantity showing, item names missing |
| B2 | Settings default date range not saving | `bug` `priority: high` | Changing default date range in settings has no effect |
| B3 | Bundle opportunities text truncation | `bug` `priority: high` | Long item names can't be read, need truncation + tooltip |

---

## SMALL ENHANCEMENTS

| # | Issue | Labels | Details |
|---|-------|--------|---------|
| E1 | Add "All Time" to date range quick select | `enhancement` `priority: high` | Avoid needing to click "Clear filters" |
| E2 | Remove duplicate settings button | `enhancement` `priority: high` | Remove top header settings, keep bottom-left only |
| E3 | Hide irrelevant filters per page | `enhancement` `priority: high` | Hide Category filter on Categories page, Branch filter on Branches page |
| E4 | Alert color consistency (severity-based) | `enhancement` `priority: high` | Critical=red, Warning=yellow, Info=blue, Good=green |
| E5 | Color consistency across app | `enhancement` `priority: high` | Standardize: red=bad, yellow=warning, green=good |
| E6 | Best day tooltip explanation | `enhancement` `priority: low` | Tooltip explains WHY it was best day |
| E7 | Tooltips for KPI cards | `enhancement` `priority: low` | Explain what each metric means |
| E8 | Tooltips for chart axes/legends | `enhancement` `priority: low` | Explain X/Y axes and colors |
| E9 | README screenshots | `documentation` `priority: low` | Add demo screenshots |

---

## MEDIUM FEATURES (1-2 sessions each)

| # | Issue | Labels | Details |
|---|-------|--------|---------|
| M1 | Revenue Reconciliation + Daily Breakdown | `enhancement` `priority: high` | Match StoreHub exactly, daily breakdown table. See Phase 13 spec |
| M2 | PDF export for any page | `enhancement` `priority: high` | Export current view as templated PDF |
| M3 | Day deep dive feature | `enhancement` `priority: low` | Hourly breakdown, top/low sellers, comparison to same day last week |
| M4 | Watch list / Item monitoring | `enhancement` `priority: low` | Track specific items under Alerts (campaigns, price changes) |
| M5 | Full Preferences System (DB sync) | `enhancement` `priority: low` | Migrate settings from localStorage to database |
| M6 | Saved Filter Presets | `enhancement` `priority: low` | Save filter combinations ("Weekend Analysis") |
| M7 | Advanced Date Comparisons | `enhancement` `priority: low` | Previous period toggle, custom comparison range |
| M8 | Export Preferences | `enhancement` `priority: low` | Default export format, included columns |

---

## MAJOR FEATURES (Need Spec First)

| # | Feature | Notes |
|---|---------|-------|
| F1 | Dashboard Layout Customization | Show/hide/reorder KPIs and charts. Needs design decisions |
| F2 | Multi-Tenant Dashboard (Operator) | Portfolio-level KPIs, cross-tenant benchmarking |

---

## QUALITATIVE DATA FEATURES (Need Spec First)

| # | Feature | Notes |
|---|---------|-------|
| Q1 | Event/Notes Log | Add annotations to charts explaining spikes/drops (promos, closures, events). Clickable timeline or markers on charts |
| Q2 | Menu Change History | Track price changes, new items, removed items with dates. Auto-correlate with performance changes |
| Q3 | PH Holidays Auto-Annotation | Auto-tag Philippine holidays (regular, special non-working). Explain "Sales up 40% - Christmas Eve" |
| Q4 | Weather Correlation | Pull weather data (PAGASA or OpenWeather), show alongside sales. "Typhoon Signal #2 - sales down 60%" |

---

## ML / FORECASTING FEATURES (Need Spec First)

| # | Feature | Notes |
|---|---------|-------|
| ML1 | Revenue Forecasting | Predict daily/weekly revenue using historical patterns. "Expected revenue tomorrow: ₱X" |
| ML2 | Item Demand Forecasting | Predict quantity per item for prep/inventory planning. "Prepare ~50 Chicken Rice tomorrow" |
| ML3 | Trend Prediction | Predict item trajectory. "Beef Bowl trending down, may become Dog in 8 weeks" |

---

## FUTURE / LOW PRIORITY

| # | Feature | Notes |
|---|---------|-------|
| X1 | White-Label Branding | Logo, custom colors, custom domain |
| X2 | Custom KPI Formulas | User-defined calculated metrics |

---

## Suggested Priority Order

**Immediate (Bugs + Quick Wins):**
1. B1, B2, B3 (bugs)
2. E1, E2, E3 (quick UX fixes)
3. E4, E5 (color consistency)

**Next (High-Impact Features):**
4. M1 - Revenue Reconciliation
5. M2 - PDF Export

**Ongoing:**
6. E6, E7, E8 (tooltips)
7. M3, M4 (day deep dive, watch list)
8. M5-M8 (preferences, filters)

**Major Features (Write Specs First):**
9. F1, F2 (dashboard customization, multi-tenant)
10. Q1, Q3 (notes log, PH holidays - high value, medium effort)
11. Q2, Q4 (menu history, weather - medium value)
12. ML1-ML3 (forecasting suite - high value, high effort)

**Low Priority:**
13. X1, X2 (white-label, custom formulas)

---

## Implementation Notes

### Qualitative Data - Suggested Order
1. **Q3 (PH Holidays)** - Easiest to implement, instant value. Just a static calendar + auto-annotation
2. **Q1 (Notes Log)** - Manual annotations, needs UI for adding/viewing notes
3. **Q2 (Menu History)** - Track changes over time, correlate with performance
4. **Q4 (Weather)** - Needs external API integration (OpenWeather or PAGASA)

### ML/Forecasting - Suggested Order
1. **ML3 (Trend Prediction)** - Easiest, can use simple linear regression on existing data
2. **ML1 (Revenue Forecasting)** - Time series forecasting (Prophet or similar)
3. **ML2 (Item Demand)** - Most complex, needs per-item models

---

*Move items to GitHub Issues when ready to work on them.*
