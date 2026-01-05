# Phase 4: App Layout

> **Goal:** Shell, sidebar, header, global filters working.
> **Branch:** `main`

---

## Deliverables

### Components
- [x] `src/components/layout/AppShell.tsx`
- [x] `src/components/layout/Sidebar.tsx`
- [x] `src/components/layout/Header.tsx`
- [x] `src/components/layout/GlobalFilters.tsx`

### State
- [x] `src/stores/uiStore.ts` - Sidebar state
- [x] `src/stores/filterStore.ts` - Global filters with URL sync

### Routing
- [x] Dashboard routes setup
- [x] Nested layout structure with `<Outlet>`

### UI Components
- [x] `src/components/ui/MultiSelect.tsx`
- [x] `src/components/ui/DateRangePicker.tsx`
- [x] `src/modules/shared/PlaceholderPage.tsx`

---

## Layout Structure

```
┌──────────────────────────────────────────────┐
│  Header (tenant name, user menu)             │
├────────┬─────────────────────────────────────┤
│        │  GlobalFilters                      │
│ Sidebar│─────────────────────────────────────│
│  (nav) │        Main Content                 │
│        │        (page component)             │
│        │                                     │
└────────┴─────────────────────────────────────┘
```

---

## Sidebar Items

```
- Dashboard (home)
- Menu Engineering
- Time Intelligence
- Performance
- Categories
- Recommendations
---
- Settings (owner/operator only)
```

---

## Global Filters

- Date range picker (react-day-picker + date-fns)
- Branch multi-select (custom Tailwind component)
- Category multi-select (custom Tailwind component)

Filters persist in URL params for shareability.

---

## Acceptance Criteria

- [x] Shell renders with sidebar and header
- [x] Sidebar collapses on mobile (drawer overlay)
- [x] Navigation works (active page gold highlight)
- [x] Filters update URL params
- [x] Filter state persists on navigation

---

## Dependencies Added

```bash
npm install react-day-picker date-fns lucide-react
```

---

## Notes

- Branch filter blocked by Phase 3 issue (missing `store_name` column) - see `docs/specs/PHASE_3_DATA.md`
- Navy + Gold design system colors configured in `src/index.css` using Tailwind v4 `@theme`

---

*Phase 4 COMPLETE*
