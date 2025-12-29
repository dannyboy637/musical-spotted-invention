# Phase 5: Analytics API

> **Goal:** All dashboard data endpoints working.
> **Branch:** `feature/phase-5-api`
> **Reference:** `docs/LEGACY_CODE.md` for calculation logic

---

## Deliverables

### Routes
- [ ] `backend/routes/analytics.py`

### Modules (port from legacy)
- [ ] `backend/modules/menu_engineering.py`
- [ ] `backend/modules/dayparting.py`
- [ ] `backend/modules/market_basket.py`
- [ ] `backend/modules/costs.py`

---

## Endpoints

```
GET /api/analytics/overview
GET /api/analytics/menu-engineering
GET /api/analytics/dayparting
GET /api/analytics/performance
GET /api/analytics/categories
GET /api/analytics/bundles
```

All endpoints accept:
- `start_date`, `end_date` (query params)
- `branches` (comma-separated)
- `categories` (comma-separated)

---

## Menu Engineering Logic

Port from `docs/LEGACY_CODE.md`:
- Core menu classification (6+ months active)
- Quadrant assignment (Star, Plowhorse, Puzzle, Dog)
- Use actual costs when available, fallback to price proxy

---

## Acceptance Criteria

- [ ] All endpoints return correct data
- [ ] Filters work (date, branch, category)
- [ ] Tenant isolation enforced
- [ ] Response times < 500ms for typical queries

---

*Phase 5 complete when all acceptance criteria checked.*
