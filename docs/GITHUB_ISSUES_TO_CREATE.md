# GitHub Issues to Create

> Copy-paste these into GitHub Issues: https://github.com/dannyboy637/musical-spotted-invention/issues/new
> Delete this file after creating the issues.

---

## BUGS (Create First)

### Issue 1: Bug - Top items by branch not showing item names
**Labels:** `bug`, `priority: high`

```
## Description
In the Branches dashboard, the "Top Items by Branch" section only shows quantities but the item names are missing.

## Steps to Reproduce
1. Go to Branches page
2. Look at "Top Items by Branch" section
3. Only quantities are displayed, no item names

## Expected Behavior
Should show item names alongside quantities (e.g., "Chicken Rice - 150 sold")

## Actual Behavior
Only showing quantities without item names
```

---

### Issue 2: Bug - Settings default date range not saving
**Labels:** `bug`, `priority: high`

```
## Description
When changing the default date range in Settings, the change doesn't persist. The app still uses the old default.

## Steps to Reproduce
1. Open Settings (bottom-left)
2. Change "Default Date Range" to a different value
3. Refresh the page or navigate away
4. Date range filter doesn't reflect the new default

## Expected Behavior
New default date range should be applied on page load

## Actual Behavior
Default date range setting has no effect
```

---

### Issue 3: Bug - Bundle opportunities text truncation
**Labels:** `bug`, `priority: high`

```
## Description
In the Recommendations page, bundle opportunities with long item names get cut off and can't be read.

## Steps to Reproduce
1. Go to Recommendations page
2. Look at Bundle Opportunities section
3. Items with long names are truncated without tooltip

## Expected Behavior
- Long names should be truncated with "..."
- Hovering should show full name in tooltip

## Actual Behavior
Text is cut off with no way to see full item names
```

---

## ENHANCEMENTS (Create After Bugs)

### Issue 4: Add "All Time" to date range quick select
**Labels:** `enhancement`, `priority: high`

```
## Problem
To see all-time data, users must click "Clear Filters" which is not intuitive. Users expect an "All Time" option.

## Proposed Solution
Add "All Time" as an option in the date range quick select dropdown, alongside "Last 7 Days", "Last 30 Days", etc.

## Acceptance Criteria
- [ ] "All Time" option appears in date range quick select
- [ ] Selecting it clears date filters and shows all data
- [ ] Works consistently across all dashboard pages
```

---

### Issue 5: Remove duplicate settings button from header
**Labels:** `enhancement`, `priority: high`

```
## Problem
There are two settings buttons - one in the header and one in the bottom-left sidebar. This is redundant.

## Proposed Solution
Remove the settings button from the header, keep only the bottom-left sidebar settings button.

## Acceptance Criteria
- [ ] Settings icon removed from header
- [ ] Settings still accessible from sidebar (bottom-left)
- [ ] No broken links or references
```

---

### Issue 6: Hide irrelevant filters on specific pages
**Labels:** `enhancement`, `priority: high`

```
## Problem
Some filters don't affect certain pages, making them useless:
- Category filter doesn't affect the Categories page
- Branch filter doesn't affect the Branches page

## Proposed Solution
Hide filters that have no effect on the current page:
- Categories page: hide Category filter
- Branches page: hide Branch filter

## Acceptance Criteria
- [ ] Category filter hidden on Categories page
- [ ] Branch filter hidden on Branches page
- [ ] Filters still work on all other pages
```

---

### Issue 7: Standardize alert colors (severity-based)
**Labels:** `enhancement`, `priority: high`

```
## Problem
Alert colors are inconsistent. Quadrant change alerts don't indicate if the change is good or bad.

## Proposed Solution
Use severity-based colors consistently:
- Critical/Bad = Red (e.g., demoted to Dog)
- Warning = Yellow (e.g., needs attention)
- Info = Blue (e.g., neutral change)
- Good = Green (e.g., promoted to Star)

For quadrant alerts:
- Star promotion → Green
- Dog demotion → Red
- Other changes → Yellow

## Acceptance Criteria
- [ ] Alert colors match severity
- [ ] Quadrant change alerts use appropriate colors
- [ ] Consistent color meaning across app
```

---

### Issue 8: Standardize color usage across app
**Labels:** `enhancement`, `priority: high`

```
## Problem
Color meanings are inconsistent. "To review" uses red in Recommendations, but yellow is used elsewhere for negative/warning.

## Proposed Solution
Establish and apply consistent color meanings:
- Red = Bad/Critical/Negative
- Yellow/Orange = Warning/Caution
- Green = Good/Positive
- Blue = Info/Neutral

## Acceptance Criteria
- [ ] Audit all color usage in the app
- [ ] Document color meanings in DESIGN_SYSTEM.md
- [ ] Update inconsistent colors to match standard
```

---

### Issue 9: Revenue Reconciliation + Daily Breakdown Table
**Labels:** `enhancement`, `priority: high`

```
## Problem
Revenue figures need to match StoreHub exactly. Users want a daily breakdown view to verify numbers.

## Proposed Solution
1. Verify revenue calculations match StoreHub (net sales, tax, service charge, discounts)
2. Add Daily Breakdown table to Dashboard and Performance pages with:
   - Date column
   - Net Sales / Tax / Service Charge / Discounts columns
   - Transactions count
   - Export to CSV

## Acceptance Criteria
- [ ] Revenue matches StoreHub reports exactly
- [ ] Daily Breakdown table on Dashboard page
- [ ] Daily Breakdown table on Performance page
- [ ] Sortable by date
- [ ] Export to CSV button
- [ ] Mobile responsive (horizontal scroll)

## Reference
See detailed spec in docs/archive/specs/PHASE_13_PIPELINE.md section 11
```

---

### Issue 10: PDF export for any dashboard page
**Labels:** `enhancement`, `priority: high`

```
## Problem
Users want to export dashboard data as PDF reports to share with stakeholders.

## Proposed Solution
Add "Export PDF" button to each dashboard page that:
- Captures current view with applied filters
- Generates a branded PDF document
- Includes header with date range and filters applied

## Acceptance Criteria
- [ ] Export PDF button on each dashboard page
- [ ] PDF includes current charts/tables
- [ ] PDF includes date range and filter info
- [ ] Professional layout with branding
```

---

## LOWER PRIORITY (Create Later)

### Issue 11: Best day tooltip explanation
**Labels:** `enhancement`, `priority: low`

```
## Problem
"Best Day" indicator doesn't explain WHY it was the best day.

## Proposed Solution
Add tooltip that shows:
- What sold more than average
- Comparison to typical day
- Top performers that day

## Acceptance Criteria
- [ ] Tooltip on "Best Day" indicator
- [ ] Shows key metrics that made it best
```

---

### Issue 12: Tooltips for KPI cards
**Labels:** `enhancement`, `priority: low`

```
## Problem
New users don't know what each KPI metric means or how it's calculated.

## Proposed Solution
Add info icon with tooltip to each KPI card explaining:
- What the metric measures
- How it's calculated
- Why it matters

## Acceptance Criteria
- [ ] Info icon on each KPI card
- [ ] Tooltip with clear explanation
- [ ] Consistent style across all KPIs
```

---

### Issue 13: Tooltips for chart axes and legends
**Labels:** `enhancement`, `priority: low`

```
## Problem
Chart axes and legends aren't always self-explanatory.

## Proposed Solution
Add tooltips explaining:
- What X and Y axes represent
- What each color/series means
- Units of measurement

## Acceptance Criteria
- [ ] Axis labels have tooltips where helpful
- [ ] Legend items have tooltips
- [ ] Consistent across all chart types
```

---

### Issue 14: Day deep dive feature
**Labels:** `enhancement`, `priority: low`

```
## Problem
Users want to analyze specific days in detail (best days, worst days).

## Proposed Solution
Click on any day to see:
- Hourly breakdown of that day
- Top items sold that day
- Low performers that day
- Comparison to same day last week

Also support "worst day" analysis.

## Acceptance Criteria
- [ ] Clickable dates in charts/tables
- [ ] Day detail modal or page
- [ ] Hourly breakdown
- [ ] Top/bottom items
- [ ] Week-over-week comparison
```

---

### Issue 15: Watch list / Item monitoring
**Labels:** `enhancement`, `priority: low`

```
## Problem
Users want to track specific items (marketing campaigns, price changes) over time.

## Proposed Solution
Add "Watch List" feature under Alerts:
- Add items to watch list
- Set custom alert thresholds per item
- Dashboard widget showing watched items performance

## Acceptance Criteria
- [ ] Add to watch list button on item details
- [ ] Watch list management in Alerts page
- [ ] Custom thresholds per watched item
- [ ] Watch list summary widget
```

---

### Issue 16: README screenshots
**Labels:** `documentation`, `priority: low`

```
## Problem
README needs screenshots to showcase the product.

## Proposed Solution
Add screenshots using demo tenant data:
- Dashboard overview
- Menu Engineering scatter plot
- Time Intelligence heatmap
- Reports page

## Acceptance Criteria
- [ ] 4-5 screenshots in docs/screenshots/
- [ ] README.md updated with images
- [ ] Using demo data only (no client data)
```

---

## Quick Create Order

**Create in this order:**
1. Issues 1-3 (bugs)
2. Issues 4-8 (high priority enhancements)
3. Issues 9-10 (medium features, high priority)
4. Issues 11-16 (low priority, create later)

**Time estimate:** ~15 minutes to create all issues
