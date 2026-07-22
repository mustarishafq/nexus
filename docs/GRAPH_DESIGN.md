# Graph & chart design

Portable spec for **Recharts / graph UI** across **every EMZI Nexus satellite app**. Use semantic tokens so charts stay readable in light and dark mode.

This repo (Nexus Brain) implements the contract below. Copy it when building or auditing other systems.

**Also in the design system:** [DESIGN_TEMPLATE.md](./DESIGN_TEMPLATE.md) §3.5 (token summary), §21 dark mode, and §28 pre-ship checklist.

---

## Reference implementation

| File | Purpose |
|------|---------|
| `frontend/src/lib/chartTooltip.jsx` | Shared Recharts tooltip styles (`chartTooltipProps`, `ChartTooltipBox`, axis/grid helpers) |
| `frontend/src/components/ui/chart.jsx` | shadcn `ChartContainer` / `ChartTooltip` / `ChartTooltipContent` |
| `frontend/src/index.css` | `--chart-1` … `--chart-5` tokens (light + `.dark`) |

Example charts using the shared tooltip helper:

| Area | File |
|------|------|
| Application usage | `frontend/src/components/applications/ApplicationUsageCharts.jsx` (daily area, by-app bar) |
| Network health | `frontend/src/pages/NetworkHealthDashboard.jsx` (latency / download / upload lines) |
| Notifications | `frontend/src/components/dashboard/NotificationChart.jsx` (type distribution bar) |

**Semantic exceptions:** Notification type series may use status tokens (`--info`, `--success`, `--warning`, `--destructive`, `--critical`) via `notificationVisuals` instead of `--chart-*`. Fallbacks still use chart tokens.

**Out of scope:** Org chart (`OrgChartTree`) is a custom HTML tree, not Recharts. Analytics embeds Metabase iframes.

---

## 1. Chart color tokens

`--chart-1` through `--chart-5` — mapped to `chart.1` … `chart.5` in Tailwind. Use for series fills, strokes, and legend dots.

| Token | Tailwind | Typical use |
|-------|----------|-------------|
| `--chart-1` | `chart.1` / `hsl(var(--chart-1))` | Primary series |
| `--chart-2` | `chart.2` | Secondary series |
| `--chart-3` | `chart.3` | Tertiary / warning-leaning |
| `--chart-4` | `chart.4` | Accent / destructive-leaning |
| `--chart-5` | `chart.5` | Accent / highlight |

Canonical HSL values (Nexus / DESIGN_TEMPLATE §3.5):

| Token | Light & dark |
|-------|----------------|
| `--chart-1` | `206 92% 36%` |
| `--chart-2` | `160 84% 39%` |
| `--chart-3` | `38 92% 50%` |
| `--chart-4` | `0 84% 60%` |
| `--chart-5` | `280 68% 60%` |

Prefer these tokens over hard-coded hex/HSL in chart components.

---

## 2. Recharts hover tooltips (required)

Default Recharts tooltips use a hard-coded white panel. In dark mode the label inherits light chart text and becomes unreadable. **Never** leave `<Tooltip />` unstyled.

### Shared helper

**File:** `frontend/src/lib/chartTooltip.jsx`

```jsx
import { chartTooltipProps, ChartTooltipBox } from '@/lib/chartTooltip';

<Tooltip
  {...chartTooltipProps}
  content={<ChartTooltipBox formatter={(v) => [v, 'Cases']} />}
/>
```

Compact frosted glass by default (`bg-popover/95` + `backdrop-blur-sm`), small padding (`6px 10px`), `11px` type. Use `ChartTooltipBox` for the shared panel chrome across all graphs.

### Props → tokens

| Prop | Token / value | Purpose |
|------|---------------|---------|
| `contentStyle.padding` | `6px 10px` | Compact panel (avoid oversized tooltips) |
| `contentStyle.fontSize` | `11px` | Match chart tick scale |
| `contentStyle.backgroundColor` | `hsl(var(--popover))` | Panel surface (light + dark) |
| `contentStyle.color` | `hsl(var(--popover-foreground))` | Default text |
| `contentStyle.border` | `1px solid hsl(var(--border))` | Theme border |
| `contentStyle.borderRadius` | `8px` | Matches control radius |
| `labelStyle.color` | `hsl(var(--foreground))` | Category / axis label (e.g. agent name, `5★`) |
| `itemStyle.color` | `hsl(var(--popover-foreground))` | Series value text (overrides Recharts’ `#000` fallback) |
| `cursor.fill` | `hsl(var(--muted) / 0.55)` | Hover band behind bars |
| `wrapperStyle.outline` | `none` | Remove focus ring on wrapper |

### Why `itemStyle.color` matters

Recharts paints each tooltip item with the series color, and falls back to `#000` when that color is missing (common with `<Cell>`-only fills). Always set `itemStyle.color` to `--popover-foreground` so “Reviews : 12” stays readable on a dark `--popover` panel.

---

## 3. Chart chrome (grid, axes, legends)

Theme the surrounding chrome with the same semantic tokens:

| Element | Rule |
|---------|------|
| Grid | `stroke="hsl(var(--border))"` (or `chartGridStroke` from `@/lib/chartTooltip`) |
| Axis ticks | `tick={{ fill: 'hsl(var(--muted-foreground))' }}` (or `chartAxisTick`) |
| Axis lines | Prefer token borders / muted foreground — not raw `#ccc` |
| Legend text | `text-muted-foreground` or equivalent token |

---

## 4. shadcn ChartContainer

When using shadcn `ChartContainer`, prefer `ChartTooltip` + `ChartTooltipContent` instead of raw Recharts `Tooltip` styles. Those components are already token-based (`bg-background`, `border-border`, `text-foreground`).

For charts that use raw Recharts `<Tooltip />` (Application usage / Network health / Notification chart), always spread `chartTooltipProps` and prefer `ChartTooltipBox` for custom formatters.

---

## 5. Do not

| Anti-pattern | Why |
|--------------|-----|
| Unstyled `<Tooltip />` | White panel + invisible labels in dark mode |
| Hard-code `bg-white` / light-only borders on `contentStyle` | Breaks dark theme |
| Hard-code `hsl(220, 13%, 91%)` or similar light greys | Same |
| Rely on series/`Cell` color alone for tooltip item text | Falls back to black (`#000`) |
| Hard-coded chart palette hex values | Use `--chart-*` tokens |

---

## 6. Pre-ship checklist

- [x] Every Recharts `<Tooltip />` spreads `chartTooltipProps` from `@/lib/chartTooltip`
- [ ] Tooltip verified in **light and dark** (label + item text both readable)
- [x] Grid / axis ticks use border / muted-foreground tokens
- [x] Series colors use `--chart-1` … `--chart-5` (or documented semantic exceptions)
- [x] New charts added to this doc’s reference table when introduced in the canonical app
