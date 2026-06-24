# Mobile Bottom Navigation — Design Spec

Portable spec for recreating the Nexus **glass dock** bottom navigation (dark mode). Use this document in Figma, another codebase, or any design system.

**Reference implementation:** `frontend/src/components/layout/BottomNav.jsx`, `AppsOrbNavItem.jsx`, `glassStyles.js`, `navItems.js`

---

## 1. Concept

A **floating glass dock** fixed to the bottom of the screen — not edge-to-edge. It uses frosted glass, large corner radius, and five evenly spaced tabs. The center tab (**Apps**) is a raised circular orb that breaks above the bar.

| Property | Value |
|----------|-------|
| Pattern name | Glass dock with hero center FAB |
| Breakpoint | Mobile only (`< 768px`) |
| Theme | Dark-first (light mode uses same tokens with adjusted glass opacity) |

---

## 2. Layout & Positioning

```
┌──────────────────────────────────────────┐
│              Page content                 │
│                                          │
│    ┌────────────────────────────────┐    │  ← 12px side margin
│    │  Home  Feed  [Apps]  Notif More│    │  ← glass dock, max-width 512px
│    └────────────────────────────────┘    │
│         ↑ safe-area bottom padding       │
└──────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Position | `fixed`, `bottom: 0`, full width, `z-index: 40` |
| Outer bottom padding | `12px + env(safe-area-inset-bottom)` |
| Horizontal inset | `12px` each side, dock centered |
| Dock max width | `512px` |
| Dock height | `68px` (`4.25rem`) |
| Dock corner radius | `16px` (`rounded-2xl`) |
| Internal horizontal padding | `4px` |
| Nav items | 5 equal columns (`flex: 1`) |
| Overflow | `visible` (orb extends above bar) |

---

## 3. Color Tokens

### Dark mode (primary — matches screenshot)

| Token | HSL | Approx hex | Usage |
|-------|-----|------------|-------|
| **Background** | `222 47% 6%` | `#0A0E17` | Page behind dock |
| **Card (glass fill)** | `222 47% 9%` at **35% opacity** | `rgba(13, 18, 30, 0.35)` | Dock background |
| **Border** | `222 40% 16%` at **70% opacity** | — | Dock outline |
| **Primary** | `206 92% 36%` | `#0878B6` | Active tab, orb |
| **Primary foreground** | `0 0% 100%` | `#FFFFFF` | Icons on orb |
| **Muted foreground** | `220 9% 56%` | `#8A919E` | Inactive labels/icons |
| **Foreground** | `220 14% 96%` | `#F1F3F5` | Hover state |
| **Destructive** | `0 62% 30%` | `#7A1E1E` | Notification badge |

### Light mode (same primary accent)

| Token | HSL |
|-------|-----|
| Background | `220 20% 97%` |
| Card (glass fill) | `0 0% 100%` at **30% opacity** |
| Muted foreground | `220 9% 46%` |
| Primary | `206 92% 36%` |

### Typography

| Property | Value |
|----------|-------|
| Font family | **Inter**, `system-ui`, `sans-serif` |
| Nav labels | `10px`, font-medium (orb label: font-semibold) |
| Line height | `1` (leading-none) |

---

## 4. Glass Dock Surface

| Effect | Spec |
|--------|------|
| Background | Semi-transparent card color (~35% opacity dark, ~30% light) |
| Backdrop blur | `24px` |
| Border | `1px`, border token |
| Shadow (dark) | `0 8px 32px rgba(0, 0, 0, 0.4)` |
| Shadow (light) | `0 8px 24px rgba(0, 0, 0, 0.08)` |
| Ring | `1px` — dark: `rgba(255, 255, 255, 0.10)`; light: `rgba(0, 0, 0, 0.05)` |

---

## 5. Standard Nav Items

**Tabs:** Home, Feed, Notifications, More

**Layout per item:** Icon above label, vertically centered, `2px` gap between icon and label.

| Element | Spec |
|---------|------|
| Icon size | `20×20px`, thin stroke (Lucide-style) |
| Label | `10px`, font-medium |
| Item padding | `4px` horizontal |
| Transition | Color transition on tap/hover |

### Active state

- Icon + label: **primary blue** (`hsl(206 92% 36%)`)
- **Top indicator:** horizontal pill at top edge of dock, centered above active icon
  - Height: `2px`
  - Width: `32px`
  - Border radius: `9999px` (full pill)
  - Color: primary blue
  - Position: `absolute top: 0`, `left: 50%`, `translateX(-50%)`

### Inactive state

- Icon + label: **muted foreground** (`hsl(220 9% 56%)` dark)
- Hover: **foreground** (`hsl(220 14% 96%)` dark)

### Icons (Lucide equivalents)

| Tab | Icon name | Description |
|-----|-----------|-------------|
| Home | `LayoutDashboard` | 2×2 grid / dashboard |
| Feed | `Newspaper` | Newspaper / document |
| Notifications | `Bell` | Bell |
| More | `Grip` | 3×3 dot grid |

---

## 6. Center “Apps” Orb (Hero Element)

The center tab is visually distinct — a **48×48px** circular button that floats **24px above** the dock top edge.

### Layer stack (bottom to top)

1. **Pulse rings** (×2) — expanding fade-out circles behind orb
2. **Nerve ring** — dotted circle with rotating impulse arc
3. **Core circle** — solid gradient blue button
4. **Icon** — white brain/monitor, cross-fading every ~12s

### Core circle

| Property | Value |
|----------|-------|
| Size | `48×48px` |
| Shape | Perfect circle (`border-radius: 9999px`) |
| Gradient | `135deg`: primary → `hsl(206 92% 42%)` → `hsl(206 92% 30%)` → primary at 85% |
| Background size | `200% 200%` (for shimmer animation) |
| Icon | White, `24×24px`, stroke width `2.25` |
| Pressed state | Scale `0.94` |

### Core shadow (breathe animation)

| Phase | Box shadow |
|-------|------------|
| Rest | `0 6px 24px hsl(primary / 45%)`, `0 0 0 3px background` |
| Peak | `0 10px 32px hsl(primary / 60%)`, `0 0 0 3px background`, `0 0 20px hsl(primary / 35%)` |
| Scale | `1` → `1.05` → `1` over `3.2s`, ease-in-out, infinite |

### Nerve ring (dotted halo)

| Property | Value |
|----------|-------|
| Position | `10px` outside core on all sides (`inset: -10px`) |
| Border | `2px dotted`, primary at 55% opacity |
| Glow | `0 0 10px hsl(primary / 12%)` |
| Active state | Border `2.5px`, primary at 75% opacity |

### Nerve impulse (rotating arc)

| Property | Value |
|----------|-------|
| Type | Conic gradient wedge (~60° arc) |
| Colors | Transparent → primary/12% → primary/55% → white/95% (highlight) → primary/55% → primary/12% → transparent |
| Mask | Radial gradient (ring shape, ~3px stroke) |
| Filter | `drop-shadow(0 0 5px hsl(primary / 45%))` |
| Animation | Rotate `360deg` over `8s`, linear, infinite |
| Active state | Stronger glow, `6.5s` duration |

### Nerve nodes

| Property | Value |
|----------|-------|
| Count | 5 |
| Size | `5×5px` each |
| Positions | `0°`, `72°`, `144°`, `216°`, `288°` on ring |
| Radius from center | `24px` |
| Animation | Fire/glow pulse synced with impulse, `8s` loop |

### Pulse rings

| Property | Value |
|----------|-------|
| Count | 2 (second delayed by `1.4s`) |
| Border | `1px solid hsl(primary / 35%)` |
| Animation | Scale `1` → `1.55`, opacity `0.45` → `0`, `2.8s` ease-out, infinite |

### Icon cross-fade

| Icon | Visibility |
|------|------------|
| Monitor | Visible first ~38% of 12s cycle |
| Brain | Visible ~44%–88% of cycle |
| Transition | Opacity + scale `0.82` ↔ `1` |

### Apps label spacing

The **Apps** label sits noticeably farther below its orb than other tabs (Home, Feed, etc. use only `2px` icon-to-label gap).

| Property | Value |
|----------|-------|
| Position | Below orb, centered |
| Size | `10px`, font-semibold, `line-height: 1` |
| Active color | Primary blue |
| Inactive color | Muted foreground |
| Flex gap (orb → label) | **`8px`** (`gap-2` on column flex) |
| Extra label margin-top | **`2px`** (`mt-0.5`) |
| **Total orb-to-label gap** | **`10px`** (8px flex gap + 2px margin) |

**Measure from:** bottom of the **48×48px orb container** (core circle), not the outer dotted nerve ring (nerve ring extends `10px` beyond core on all sides).

| Tab type | Icon-to-label gap |
|----------|-------------------|
| Standard (Home, Feed, etc.) | `2px` (`gap-0.5`) |
| Apps (orb) | `10px` (`gap-2` + `mt-0.5`) |

### Reduced motion

When `prefers-reduced-motion: reduce`:

- Disable all orb animations
- Show monitor icon only (brain hidden)
- Static core shadow (rest state)
- Hide nerve impulse; nodes at 45% opacity

---

## 7. Notification Badge

Used on tabs with unread counts (e.g. Notifications).

| Property | Value |
|----------|-------|
| Position | Top-right of icon: `-8px` right, `-6px` top |
| Min size | `16×16px` |
| Shape | Pill / circle (`border-radius: 9999px`) |
| Background | Destructive red |
| Text | `9px` bold, destructive-foreground (white) |
| Padding | `4px` horizontal |
| Cap | Display `99+` when count > 99 |

---

## 8. Navigation Map

| # | Label | Route | Type |
|---|-------|-------|------|
| 1 | Home | `/` | Standard link |
| 2 | Feed | `/feed` | Standard link |
| 3 | Apps | `/applications` | Center orb |
| 4 | Notifications | `/notifications` | Standard link + badge |
| 5 | More | — | Opens bottom sheet menu |

### More menu (bottom sheet)

Triggered by **More** tab. Not part of the dock chrome.

| Property | Value |
|----------|-------|
| Sheet position | Bottom, `rounded-t-2xl` |
| Overlay | `rgba(0, 0, 0, 0.25)` + `backdrop-blur-sm` |
| Panel | Glass dialog styles (higher opacity than dock) |

**Secondary routes:** People, Company Feed, Messages, Activity Feed, Calendar, Network Health, Settings; admin: Broadcast, System Events, User Management.

---

## 9. Wireframe

```
                    ┌─────┐
                    │ ●●● │  ← dotted nerve ring + impulse arc
                   ╱│ 🧠 │╲
                  │ │     │ │  ← 48px blue gradient orb
                   ╲│     │╱
    ────────────────┴─────┴────────────────
    │ ▬ │      │      │       │      │   │  ← active top bar (Home)
    │ ⊞ │      │ 📰   │  Apps │  🔔  │ ⋮⋮ │  ← icons
    │Home│     │ Feed │       │ Notif│More│  ← 10px labels
    └──────────────────────────────────────┘
              glass dock (rounded-2xl)
```

---

## 10. Figma / Design Tool Checklist

- [ ] Frame: `390×844` (iPhone), dark background `#0A0E17`
- [ ] Dock component: `366×68px`, radius `16px`, glass fill + blur
- [ ] 5-column auto-layout; center column taller (orb overflow)
- [ ] Variants: `default` / `active` per tab (color + top indicator)
- [ ] Orb component: pulse, nerve ring, gradient fill, icon
- [ ] Safe area: `12px` + home indicator inset at bottom
- [ ] States: inactive, active, pressed (orb scale `0.94`)
- [ ] Badge component on Notifications icon

---

## 11. CSS Custom Properties (copy-paste)

```css
:root {
  --nav-primary: 206 92% 36%;
  --nav-primary-hex: #0878B6;
  --nav-bg-dark: 222 47% 6%;
  --nav-card-dark: 222 47% 9%;
  --nav-muted-fg-dark: 220 9% 56%;
  --nav-fg-dark: 220 14% 96%;

  --dock-height: 4.25rem;       /* 68px */
  --dock-radius: 1rem;          /* 16px */
  --dock-max-width: 32rem;      /* 512px */
  --dock-side-inset: 0.75rem;   /* 12px */
  --nav-icon-size: 1.25rem;     /* 20px */
  --nav-label-size: 0.625rem;   /* 10px */
  --nav-active-bar-w: 2rem;     /* 32px */
  --nav-active-bar-h: 0.125rem; /* 2px */
  --orb-size: 3rem;             /* 48px */
  --orb-lift: 1.5rem;           /* 24px above dock */
  --orb-label-gap: 0.5rem;      /* 8px flex gap */
  --orb-label-margin-top: 0.125rem; /* 2px extra */
  --orb-label-total-gap: 0.625rem;  /* 10px orb bottom → "Apps" text */
  --nav-standard-icon-label-gap: 0.125rem; /* 2px for other tabs */
}
```

---

## 12. Design Principles

1. **Floating, not flush** — dock sits inset from screen edges
2. **Glass morphism** — blur + low-opacity fill, not a solid bar
3. **One hero action** — center orb draws attention to Apps
4. **Minimal labels** — 10px text; icons carry most meaning
5. **Subtle active cue** — thin top bar, not a full background fill
6. **Dark-first** — navy UI with blue accent; light mode supported via same tokens

---

## 13. Visibility Rules

| Condition | Bottom nav |
|-----------|------------|
| Standard mobile pages | Shown |
| `/applications/:id/view` (embedded app view) | Hidden |
| Viewport `≥ 768px` | Desktop nav pattern (horizontal scroll dock or sidebar) |
