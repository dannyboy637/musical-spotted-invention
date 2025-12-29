# Phase 3: Data Pipeline

> **Goal:** CSV import, cleaning, and storage working.
> **Branch:** `feature/phase-3-data`
> **Reference:** `docs/LEGACY_CODE.md` for business logic

---

## Deliverables

### Database
- [ ] `transactions` table
- [ ] `menu_items` table (aggregated)
- [ ] Indexes for common queries

### Backend
- [ ] `backend/scripts/import_storehub.py` - CSV import
- [ ] `backend/modules/data_processing.py` - Cleaning logic
- [ ] Port category exclusions from legacy
- [ ] Port macro category mapping from legacy
- [ ] Port service charge allocation from legacy

### Storage
- [ ] Supabase Storage bucket per tenant
- [ ] Upload endpoint for CSVs

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

- [ ] CSV upload works
- [ ] Import parses StoreHub format correctly
- [ ] Transactions table populated
- [ ] Menu items aggregated
- [ ] Category exclusions applied
- [ ] Service charge allocated properly

---

*Phase 3 complete when all acceptance criteria checked.*
