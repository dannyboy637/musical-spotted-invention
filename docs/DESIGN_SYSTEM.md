# Design System

> Professional, clean, data-focused. NOT the typical "AI-generated" look.
> Inspired by: Lightspeed, Tableau, Stripe Dashboard

---

## Color Palette

### Primary Colors (Navy + Gold)

```css
/* Navy - Primary brand color */
--navy-50: #f0f4f8;
--navy-100: #d9e2ec;
--navy-200: #bcccdc;
--navy-300: #9fb3c8;
--navy-400: #829ab1;
--navy-500: #627d98;
--navy-600: #486581;
--navy-700: #334e68;
--navy-800: #243b53;
--navy-900: #102a43;

/* Gold - Accent color */
--gold-50: #fffbeb;
--gold-100: #fef3c7;
--gold-200: #fde68a;
--gold-300: #fcd34d;
--gold-400: #fbbf24;
--gold-500: #f59e0b;
--gold-600: #d97706;
--gold-700: #b45309;
```

### Semantic Colors

```css
/* Status colors */
--success: #10b981;  /* Emerald 500 */
--warning: #f59e0b;  /* Amber 500 */
--danger: #ef4444;   /* Red 500 */
--info: #3b82f6;     /* Blue 500 */

/* Neutrals */
--background: #f8fafc;  /* Slate 50 */
--surface: #ffffff;
--border: #e2e8f0;      /* Slate 200 */
--text-primary: #1e293b;   /* Slate 800 */
--text-secondary: #64748b; /* Slate 500 */
--text-muted: #94a3b8;     /* Slate 400 */
```

### Chart Colors (6-color palette)

```javascript
const chartColors = [
  '#334e68', // Navy 700 - Primary
  '#f59e0b', // Gold 500 - Accent
  '#10b981', // Emerald - Success
  '#3b82f6', // Blue - Info
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];
```

---

## Typography

### Font Stack

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Scale

| Name | Size | Weight | Use |
|------|------|--------|-----|
| Display | 36px | 700 | Page titles |
| H1 | 30px | 600 | Section headers |
| H2 | 24px | 600 | Card titles |
| H3 | 20px | 600 | Subsections |
| Body | 16px | 400 | Default text |
| Small | 14px | 400 | Secondary text |
| Caption | 12px | 500 | Labels, captions |

### Tailwind Classes

```html
<h1 class="text-3xl font-semibold text-slate-800">Page Title</h1>
<h2 class="text-xl font-semibold text-slate-800">Card Title</h2>
<p class="text-base text-slate-600">Body text</p>
<span class="text-sm text-slate-500">Secondary text</span>
<label class="text-xs font-medium text-slate-400 uppercase tracking-wide">Label</label>
```

---

## Spacing

Use Tailwind's spacing scale consistently:

| Token | Value | Use |
|-------|-------|-----|
| 1 | 4px | Tight gaps |
| 2 | 8px | Icon gaps |
| 3 | 12px | Small padding |
| 4 | 16px | Default padding |
| 6 | 24px | Card padding |
| 8 | 32px | Section gaps |

---

## Components

### Cards

```jsx
<div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
  <h3 className="text-lg font-semibold text-slate-800 mb-4">Card Title</h3>
  {/* content */}
</div>
```

### KPI Cards

```jsx
<div className="bg-white rounded-lg border border-slate-200 p-6">
  <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Revenue</p>
  <p className="text-3xl font-semibold text-slate-800 mt-1">₱2.4M</p>
  <p className="text-sm text-emerald-600 mt-2 flex items-center gap-1">
    <TrendingUp size={16} />
    +12.5% vs last period
  </p>
</div>
```

### Buttons

```jsx
// Primary
<button className="bg-navy-700 text-white px-4 py-2 rounded-md font-medium hover:bg-navy-800 transition-colors">
  Primary Action
</button>

// Secondary
<button className="bg-white text-slate-700 px-4 py-2 rounded-md font-medium border border-slate-300 hover:bg-slate-50 transition-colors">
  Secondary Action
</button>

// Ghost
<button className="text-slate-600 px-4 py-2 rounded-md font-medium hover:bg-slate-100 transition-colors">
  Ghost Action
</button>
```

### Tables

```jsx
<table className="w-full">
  <thead>
    <tr className="border-b border-slate-200">
      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-3 px-4">
        Item
      </th>
      <th className="text-right ...">Revenue</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-slate-100">
    <tr className="hover:bg-slate-50">
      <td className="py-3 px-4 text-sm text-slate-800">Tapa Rice Bowl</td>
      <td className="py-3 px-4 text-sm text-slate-800 text-right">₱145,000</td>
    </tr>
  </tbody>
</table>
```

---

## Charts

### Standard Config

```javascript
const chartConfig = {
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  colors: chartColors,
  grid: {
    stroke: '#e2e8f0',
    strokeDasharray: '3 3',
  },
  axis: {
    tick: { fill: '#64748b', fontSize: 12 },
    axisLine: { stroke: '#e2e8f0' },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
  },
};
```

### Chart Types by Use Case

| Use Case | Chart Type |
|----------|------------|
| Trends over time | Line chart |
| Category comparison | Horizontal bar |
| Distribution | Vertical bar |
| Part of whole | Donut (not pie) |
| Two metrics | Scatter plot |
| Heat patterns | Heatmap |

---

## Layout

### Sidebar Width
- Collapsed: 64px
- Expanded: 256px

### Content Max Width
- 1400px (centered)

### Grid
- Use 12-column grid via Tailwind
- Common patterns: `grid-cols-4` for KPIs, `grid-cols-2` for charts

---

## Iconography

Use **Lucide React** icons consistently:
- Size: 20px for UI, 16px for inline
- Stroke width: 2

```jsx
import { TrendingUp, AlertCircle, ChevronRight } from 'lucide-react';
```

---

## Motion

Keep animations subtle:
- Duration: 150-200ms
- Easing: ease-out

```css
transition-colors duration-150 ease-out
transition-all duration-200 ease-out
```

---

## Do's and Don'ts

### Do
- Use consistent spacing (multiples of 4px)
- Keep charts clean with minimal gridlines
- Use navy for primary actions
- Use gold sparingly for highlights
- Left-align text, right-align numbers

### Don't
- Use teal/coral (too "AI generated")
- Use more than 6 colors in a chart
- Use pie charts (use donut instead)
- Use gradients on data visualizations
- Over-animate UI elements

---

*Last updated: 2024-12-30*
