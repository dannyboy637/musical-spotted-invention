# Phase 3: Data Pipeline

> **Goal:** CSV import, cleaning, and storage working.
> **Branch:** `main`
> **Reference:** `docs/LEGACY_CODE.md` for business logic

---

## Deliverables

### Database
- [x] `transactions` table
- [x] `menu_items` table (aggregated)
- [x] `data_import_jobs` table (audit/progress)
- [x] Indexes for common queries
- [x] Aggregation functions (`aggregate_menu_items`, `get_transaction_summary`)

### Backend
- [x] `backend/scripts/import_storehub.py` - CSV import CLI
- [x] `backend/modules/data_processing.py` - Cleaning logic
- [x] `backend/services/import_service.py` - Import orchestration
- [x] `backend/routes/data.py` - API endpoints
- [x] Port category exclusions from legacy
- [x] Port macro category mapping from legacy
- [x] Port service charge allocation from legacy

### Storage
- [x] Supabase Storage bucket design (shared with tenant prefix)
- [x] Upload endpoint for CSVs (`POST /data/upload`)

---

## Import Flow

```
1. CSV uploaded to Supabase Storage
2. Import script triggered
3. Parse CSV (handle StoreHub multi-row format)
4. Clean and enrich data
5. Insert into transactions table
6. Regenerate menu_items aggregation
```

---

## Critical Logic to Port

See `docs/LEGACY_CODE.md` for:
- Category exclusions (17 categories)
- Macro category mapping
- Receipt parsing (multi-row structure)
- Service charge allocation

---

## Acceptance Criteria

- [x] CSV upload works
- [x] Import parses StoreHub format correctly
- [x] Transactions table populated
- [x] Menu items aggregated
- [x] Category exclusions applied
- [x] Service charge allocated properly

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/data/upload` | owner, operator | Upload CSV file |
| GET | `/data/imports` | all | List import jobs |
| GET | `/data/imports/{id}` | all | Get import job details |
| GET | `/data/transactions` | all | List transactions |
| GET | `/data/transactions/summary` | all | Get summary stats |
| GET | `/data/menu-items` | all | List menu items |
| POST | `/data/menu-items/regenerate` | owner, operator | Regenerate aggregation |
| DELETE | `/data/transactions` | owner, operator | Delete transactions |

---

## Setup Instructions

1. **Run migrations** in Supabase SQL Editor (in order):
   - `003_create_transactions_table.sql`
   - `004_create_menu_items_table.sql`
   - `005_create_data_import_jobs_table.sql`
   - `006_create_aggregation_functions.sql`

2. **Create storage bucket** in Supabase Dashboard:
   - Bucket name: `csv-uploads`
   - Public: No
   - Add RLS policies (see migration comments)

3. **Install pandas**:
   ```bash
   cd backend
   pip install pandas>=2.0.0
   ```

---

## Known Issues / TODO

~~### Missing `store_name` column (Branch support)~~ **RESOLVED**

Fixed on 2025-12-30:
- Added `store_name` column via migration `007_add_store_name_column.sql`
- Updated `transform_storehub_row()` to extract Store column
- Updated `/data/branches` endpoint to query `store_name` directly
- Re-imported data: 207,743 Legazpi + 75,894 Proscenium = 283,637 total

---

*Phase 3 COMPLETE*
