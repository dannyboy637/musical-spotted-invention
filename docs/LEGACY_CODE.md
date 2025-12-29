# Legacy Code Reference

> **DO NOT rewrite from scratch** - port and adapt this proven logic.
> This document maps existing MVP Python scripts to the new multi-tenant architecture.

---

## Overview

The Spotted Pig Manila MVP was built with three core scripts:

| Script | Purpose | New Location |
|--------|---------|--------------|
| `clean_data.py` | Clean and transform StoreHub exports | `backend/modules/data_processing.py` |
| `merge_and_validate.py` | Merge multiple CSV exports | `backend/scripts/import_storehub.py` |
| `weekly_update.py` | Incremental data updates | `backend/services/sync_service.py` |

---

## Critical Business Logic to Preserve

### 1. Category Exclusions (from clean_data.py)

These 17 categories are **excluded from core menu analysis**:

```python
EXCLUDE_CATEGORIES = [
    'Spirits', 'MIXERS', 'Extras', 'Pour Over Bar', 'Retail Beans',
    'Merchandise', 'Breakage/Corkage', 'Online- Food', 'Online- Drinks', 'Water',
    'Wine', 'Wine: Glass', 'Beers', 'Cocktails',
    'Events', 'Foodpanda/Grab', 'Party Tray'
]
```

**Why:** Spirits shots, mixers, and add-ons skew menu engineering results. They're not standalone menu items.

### 2. Macro Category Mapping (from clean_data.py)

Maps 35+ StoreHub categories to 6 macro categories:

```python
MACRO_CATEGORY_MAP = {
    # FOOD
    'All Day Brunch': 'FOOD',
    'Rice Bowls': 'FOOD',
    'Pasta': 'FOOD',
    'Sandwiches': 'FOOD',
    'Salads': 'FOOD',
    # ... more mappings
    
    # BEVERAGE (non-alcoholic)
    'Espresso Bar': 'BEVERAGE',
    'Coffee Creations': 'BEVERAGE',
    'Non Coffee': 'BEVERAGE',
    
    # ALCOHOL
    'Cocktails': 'ALCOHOL',
    'Wine': 'ALCOHOL',
    'Beers': 'ALCOHOL',
    
    # SWEETS
    'Sweets': 'SWEETS',
    'Pastries': 'SWEETS',
    
    # RETAIL
    'Retail Beans': 'RETAIL',
    'Merchandise': 'RETAIL',
    
    # OTHER
    'Extras': 'OTHER',
}
```

### 3. Core Menu Classification (from clean_data.py)

Items must meet **two criteria** to be considered "core menu":

```python
MIN_MONTHS_ACTIVE = 6  # Must be active for 6+ months
RECENCY_DAYS = 30      # Must have sold in last 30 days

# Classification logic
is_core_menu = (
    category not in EXCLUDE_CATEGORIES and
    months_active >= MIN_MONTHS_ACTIVE
)

is_current_menu = days_since_last_sale <= RECENCY_DAYS
```

### 4. Menu Engineering Quadrants (from clean_data.py)

Uses BCG matrix approach with median thresholds:

```python
def assign_quadrant(row, median_quantity, median_price):
    high_popularity = row['total_quantity'] >= median_quantity
    high_profit = row['avg_price'] >= median_price  # Price as profit proxy
    
    if high_popularity and high_profit:
        return 'Star'
    elif high_popularity and not high_profit:
        return 'Plowhorse'
    elif not high_popularity and high_profit:
        return 'Puzzle'
    else:
        return 'Dog'
```

**Note:** Current logic uses `avg_price` as profit proxy since cost data was incomplete. New system will use actual costs when available.

### 5. Service Charge Allocation (from clean_data.py)

StoreHub records service charge as a separate line item. We allocate it proportionally:

```python
# Calculate allocated service charge per item
allocated_sc = (item_subtotal / receipt_subtotal) * receipt_service_charge

# Gross revenue includes tax and allocated service charge
gross_revenue = subtotal + tax + allocated_sc + discount  # discount is negative
```

### 6. Receipt Parsing (from merge_and_validate.py)

StoreHub CSVs have multi-row structure per receipt:
- Row 1: Summary row (blank Item, shows totals)
- Row 2: Service Charge line
- Rows 3+: Actual menu items
- Final row: Payment method breakdown

```python
# Filter to actual item rows
items_df = df[
    df['Item'].notna() &
    (df['Item'] != '') &
    (df['Item'] != 'Service Charge')
]
```

### 7. Duplicate Handling (from merge_and_validate.py)

**Do NOT deduplicate** on receipt_number + item_name. Legitimate duplicates exist:
- Customer orders 2x Tapa → 2 rows with quantity=1 each
- Same item with different variants → separate rows

```python
# WRONG: This removes legitimate data
# df.drop_duplicates(subset=['receipt_number', 'item_name'])

# RIGHT: Keep all rows, let quantity reflect actual orders
# Just validate structure, don't dedupe
```

### 8. Incremental Updates (from weekly_update.py)

Weekly update logic:
1. Load new CSV export
2. Find max date in existing data
3. Filter new data to only rows after max date
4. Append to existing dataset
5. Backup old file first

```python
def incremental_update(existing_df, new_df):
    max_existing_date = existing_df['timestamp'].max()
    new_rows = new_df[new_df['timestamp'] > max_existing_date]
    return pd.concat([existing_df, new_rows])
```

---

## Adaptation for Multi-Tenant

### What Changes

| Original | New System |
|----------|------------|
| Hardcoded file paths | Tenant-specific paths in Supabase Storage |
| Single CSV files | PostgreSQL tables with tenant_id |
| Local parquet files | Database queries with RLS |
| Single config | Tenant settings in `tenants.settings` JSONB |

### What Stays the Same

- Category exclusion logic
- Macro category mapping
- Core menu classification rules
- Quadrant calculation methodology
- Service charge allocation formula
- Receipt parsing logic

---

## Port Checklist

When implementing each module, reference this checklist:

### Data Processing Module
- [ ] Port category exclusions (make configurable per tenant)
- [ ] Port macro category mapping
- [ ] Port service charge allocation
- [ ] Port receipt parsing logic
- [ ] Add tenant_id to all operations

### Menu Engineering Module
- [ ] Port core menu classification
- [ ] Port quadrant calculation
- [ ] Add support for actual costs (not just price proxy)
- [ ] Add branch filtering
- [ ] Add date range filtering

### Sync Service
- [ ] Port incremental update logic
- [ ] Add validation before insert
- [ ] Add rollback on failure
- [ ] Log sync history to `data_sync_jobs` table

---

## File Locations (Original MVP)

```
sp_analysis/
├── scripts/
│   ├── clean_data.py        # Main transformation logic
│   ├── merge_and_validate.py # CSV merging
│   └── weekly_update.py      # Incremental updates
├── data/
│   └── transactions_merged_raw.csv
├── outputs/
│   ├── clean_data/
│   │   ├── clean_transactions.parquet
│   │   ├── clean_menu_items.parquet
│   │   └── menu_engineering_items.parquet
│   ├── items_to_cut.csv
│   └── items_to_promote.csv
└── dashboard/
    └── (Streamlit app)
```

---

*Reference this document when building Phases 3, 5, and 7.*
