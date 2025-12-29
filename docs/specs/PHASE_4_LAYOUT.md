# Phase 4: App Layout

> **Goal:** Shell, sidebar, header, global filters working.
> **Branch:** `feature/phase-4-layout`

---

## Deliverables

### Components
- [ ] `src/components/layout/AppShell.tsx`
- [ ] `src/components/layout/Sidebar.tsx`
- [ ] `src/components/layout/Header.tsx`
- [ ] `src/components/layout/GlobalFilters.tsx`

### State
- [ ] `src/stores/uiStore.ts` - Sidebar state, filters

### Routing
- [ ] Dashboard routes setup
- [ ] Nested layout structure

---

## Layout Structure

```
┌──────────────────────────────────────────────┐
│  Header (tenant name, user menu)             │
├────────┬─────────────────────────────────────┤
│        │                                     │
│ Sidebar│        Main Content                 │
│  (nav) │        (page component)             │
│        │                                     │
│        │                                     │
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
- Settings (owner only)
```

---

## Global Filters

- Date range picker
- Branch multi-select
- Category multi-select

Filters persist in URL params for shareability.

---

## Acceptance Criteria

- [ ] Shell renders with sidebar and header
- [ ] Sidebar collapses on mobile
- [ ] Navigation works
- [ ] Filters update URL params
- [ ] Filter state persists on navigation

---

*Phase 4 complete when all acceptance criteria checked.*
