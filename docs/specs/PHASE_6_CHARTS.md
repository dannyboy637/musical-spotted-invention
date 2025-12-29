# Phase 6: Chart Components

> **Goal:** Reusable chart wrappers with consistent styling.
> **Branch:** `feature/phase-6-charts`

---

## Deliverables

### Components
- [ ] `src/components/charts/LineChart.tsx`
- [ ] `src/components/charts/BarChart.tsx`
- [ ] `src/components/charts/DonutChart.tsx`
- [ ] `src/components/charts/Heatmap.tsx`
- [ ] `src/components/charts/ScatterPlot.tsx`
- [ ] `src/components/charts/ChartContainer.tsx` (loading, empty states)

### Config
- [ ] `src/lib/chartConfig.ts` - Colors, defaults

---

## Chart Wrapper Pattern

```tsx
<ChartContainer title="Revenue by Category" loading={isLoading} empty={!data}>
  <BarChart data={data} xKey="category" yKey="revenue" />
</ChartContainer>
```

---

## Standard Config

See `docs/DESIGN_SYSTEM.md` for:
- Color palette (6 colors)
- Grid styling
- Tooltip styling
- Axis formatting

---

## Acceptance Criteria

- [ ] All chart types render correctly
- [ ] Loading states show skeleton
- [ ] Empty states show message
- [ ] Tooltips work
- [ ] Responsive on mobile

---

*Phase 6 complete when all acceptance criteria checked.*
