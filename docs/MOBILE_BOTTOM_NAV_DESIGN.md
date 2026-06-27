# Bottom Navigation (Glass Dock) — Design Spec

Portable spec for recreating the Nexus **glass dock** bottom navigation across **mobile, tablet, and desktop**. Use this document in Figma, another codebase, or any design system.

**Reference implementation:**

| File | Purpose |
|------|---------|
| `frontend/src/components/layout/BottomNav.jsx` | Responsive dock shell + nav item rendering |
| `frontend/src/components/layout/AppsOrbNavItem.jsx` | Mobile-only center Apps orb (JSX structure) |
| `frontend/src/components/layout/MobileMoreMenu.jsx` | Mobile More bottom sheet |
| `frontend/src/components/layout/glassStyles.js` | Glass surface tokens (`glassDockStyles`, `glassPanelStyles`) |
| `frontend/src/components/layout/navItems.js` | Mobile + desktop route maps |
| `frontend/src/components/layout/AppLayout.jsx` | Page padding + dock visibility |
| `frontend/src/components/layout/TopBar.jsx` | Top chrome (desktop actions) |
| `frontend/src/index.css` | Apps orb keyframes + class rules (§14) |
| `frontend/src/hooks/use-mobile.jsx` | Breakpoint detection (`768px`) |

---

## 1. Concept

A **floating glass dock** fixed to the bottom of the screen — not edge-to-edge. It uses frosted glass, large corner radius, and icon+label tabs.

| Viewport | Pattern |
|----------|---------|
| **Mobile** (`< 768px`) | 5 equal tabs; center **Apps** is a raised circular orb that breaks above the bar |
| **Tablet & desktop** (`≥ 768px`) | Horizontal scrolling dock with **all primary routes** as standard tabs (no orb, no More sheet) |

| Property | Value |
|----------|-------|
| Pattern name | Glass dock with hero center FAB (mobile only) |
| Breakpoint | Single switch at **`768px`** — no separate tablet tier |
| Theme | Dark-first (light mode uses same tokens with adjusted glass opacity) |
| Top chrome | Fixed glass **TopBar** (`h-16`) on all sizes; desktop adds theme/notifications/profile in header |

### Responsive decision tree

```
Viewport width
├── < 768px  → MOBILE_BOTTOM_NAV_ITEMS (5 tabs + orb + More sheet)
└── ≥ 768px  → buildDesktopNavItems() (scroll dock, standard tabs only)
```

Implement with `useIsMobile()` — true when `window.innerWidth < 768`.

---

## 2. Shared Layout & Positioning

Both mobile and desktop use the same outer shell.

```
┌──────────────────────────────────────────┐
│  TopBar (fixed top, h-16, glass)         │
├──────────────────────────────────────────┤
│              Page content                 │
│         (pb clears bottom dock)           │
│                                          │
│    ┌────────────────────────────────┐    │  ← horizontal inset
│    │  … nav items …                 │    │  ← glass dock
│    └────────────────────────────────┘    │
│         ↑ safe-area bottom padding       │
└──────────────────────────────────────────┘
```

### Outer shell (all viewports)

| Property | Value |
|----------|-------|
| Position | `fixed`, `bottom: 0`, `left: 0`, `right: 0`, `z-index: 40` |
| Outer bottom padding | `12px + env(safe-area-inset-bottom)` → `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` |
| Horizontal wrapper | `flex justify-center px-3 sm:px-4` (12px mobile, 16px at `sm+`) |
| Dock surface | `glassDockStyles` = `glassPanelStyles` + `rounded-2xl border` |
| Internal horizontal padding | `4px` (`px-1`) |
| Dock corner radius | `16px` (`rounded-2xl`) |

### Glass surface (`glassPanelStyles` / `glassDockStyles`)

| Effect | Light | Dark |
|--------|-------|------|
| Backdrop blur | `24px` (`backdrop-blur-2xl`) | same |
| Background | `bg-card/30` | `dark:bg-card/35` |
| Border | `border-border/50` | `dark:border-border/70` |
| Shadow | `0 8px 24px rgba(0,0,0,0.08)` | `0 8px 32px rgba(0,0,0,0.4)` |
| Ring | `ring-1 ring-black/5` | `dark:ring-white/10` |

### Page content clearance (`AppLayout.jsx`)

When the bottom nav is visible, add bottom padding to `<main>` so content is not obscured:

```
pb-[calc(5.25rem+env(safe-area-inset-bottom))]
```

| Token | Value | Breakdown |
|-------|-------|-----------|
| `5.25rem` | `84px` | Dock footprint + bottom inset (works for mobile orb label clearance) |
| Safe area | `env(safe-area-inset-bottom)` | Home indicator on iOS |

Top padding: `pt-16` (`64px`) for fixed TopBar. Adjust upward when alert strips are present (see `AppLayout.jsx`).

---

## 3. Mobile Layout (`< 768px`)

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
| Dock height | `68px` (`4.25rem` / `h-[4.25rem]`) |
| Dock width | `w-full max-w-lg` → **512px** max, centered |
| Nav items | 5 equal columns (`flex-1`) |
| Overflow | `visible` (orb extends above bar) |
| Apps tab | `AppsOrbNavItem` — hero orb (§7) |
| More tab | Opens bottom sheet (§9) — not a route |

---

## 4. Desktop & Tablet Layout (`≥ 768px`)

Tablet landscape and desktop share the **same** dock pattern. There is no separate tablet spec.

```
┌──────────────────────────────────────────────────────────────┐
│                        Page content                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Dash │ People │ Org │ Feed │ Msg │ … │ App │ Notif │ … │→│  scroll
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Dock height | `64px` (`4rem` / `h-16`) — **not** 68px |
| Dock width | `w-fit max-w-full` — grows with content, capped to viewport |
| Overflow | `overflow-x-auto` with **hidden scrollbar** |
| Nav items | One tab per route; `min-w-[4.5rem] shrink-0 px-2` |
| Apps tab | **Standard link** with `Monitor` icon — **no orb** |
| More tab | **Not shown** — all routes are direct dock tabs |
| Item layout | `flex flex-col items-center justify-center gap-0.5` |

### Hidden scrollbar (Tailwind)

```
overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
```

### Desktop vs mobile differences (quick reference)

| Property | Mobile | Desktop / tablet |
|----------|--------|-------------------|
| Breakpoint | `< 768px` | `≥ 768px` |
| Dock height | 68px | 64px |
| Max width | 512px centered | Viewport width, content-sized |
| Tab count | 5 (+ More sheet) | 12–15 (conditional) |
| Tab width | `flex-1` equal | `min-w-[4.5rem]` fixed min |
| Apps tab | Hero orb | Plain icon link |
| Notifications (mobile) | Bottom nav tab | Bottom nav tab |
| Notifications (desktop header) | — | TopBar bell + slide-in panel |
| Theme toggle | More sheet footer | TopBar |

---

## 5. Color Tokens

### Dark mode (primary)

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

### Light mode

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

## 6. Standard Nav Items

**Layout per item:** Icon above label, vertically centered, `2px` gap (`gap-0.5`).

| Element | Spec |
|---------|------|
| Container | `relative flex flex-col items-center justify-center gap-0.5 transition-colors` |
| Icon size | `20×20px` (`h-5 w-5`), Lucide-style stroke |
| Label | `10px` (`text-[10px]`), font-medium, leading-none |
| Mobile padding | `px-1`, `flex-1` |
| Desktop padding | `px-2`, `min-w-[4.5rem] shrink-0` |
| Transition | Color on tap/hover |

### Active state

- Icon + label: **primary blue** (`hsl(206 92% 36%)`)
- **Top indicator:** horizontal pill at top edge of dock, centered above active icon
  - Height: `2px` (`h-0.5`)
  - Width: `32px` (`w-8`)
  - Border radius: full pill
  - Color: primary
  - Position: `absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-primary`

### Inactive state

- Icon + label: **muted foreground**
- Hover: **foreground**

### Icons (Lucide)

| Tab | Icon | Notes |
|-----|------|-------|
| Home / Dashboard | `LayoutDashboard` | Mobile label "Home", desktop "Dashboard" |
| Feed | `Newspaper` | |
| Apps / Application | `Monitor` | Mobile = orb; desktop = standard tab |
| Notifications | `Bell` | Badge when unread |
| Messages | `Mail` | Desktop dock only; badge when unread |
| More | `Grip` | Mobile only — 3×3 dot grid |
| People | `Users` | Desktop + More sheet |
| Organization | `GitBranch` | Desktop + More sheet |
| Analytics | `BarChart3` | Conditional (admin or dashboards exist) |
| Activity | `Activity` | |
| Network | `Wifi` | Label "Network" |
| Attendance | `Clock` | |
| Calendar | `Calendar` | |
| Profile | `User` | More sheet only |
| Settings | `Settings` | Desktop + More sheet |
| Broadcast | `Megaphone` | Admin |
| Events | `Shield` | Admin — label "Events" |
| Users (admin) | `Users` | Admin — label "Users" |

---

## 7. Center “Apps” Orb — Mobile Only

The center mobile tab is a **48×48px** circular button that floats **24px above** the dock top edge (`-mt-6` on a `3rem` orb container).

> **Desktop/tablet:** Do not render the orb. Use a standard nav link with the `Monitor` icon and label "Application".

### JSX structure (`AppsOrbNavItem.jsx`)

```
Link (flex-1 flex-col items-center justify-end gap-2 pb-1)
├── span.apps-orb-nav (-mt-6, 48×48, pointer-events-none)
│   ├── span.apps-orb-nav__pulse
│   ├── span.apps-orb-nav__pulse.apps-orb-nav__pulse--delayed
│   ├── span.apps-orb-nav__nerve
│   │   ├── span.apps-orb-nav__nerve-track
│   │   ├── span.apps-orb-nav__nerve-impulse
│   │   └── span.apps-orb-nav__nerve-node ×5 (angles 0, 72, 144, 216, 288)
│   └── span.apps-orb-nav__core
│       ├── span.apps-orb-nav__icon.apps-orb-nav__icon--monitor → Monitor 24×24
│       └── span.apps-orb-nav__icon.apps-orb-nav__icon--brain → Brain 24×24
└── span label (text-[10px] font-semibold mt-0.5)
```

### Layer stack (bottom to top)

1. **Pulse rings** (×2) — expanding fade-out circles
2. **Nerve ring** — dotted circle + rotating impulse arc + 5 nodes
3. **Core circle** — gradient blue button
4. **Icons** — white Monitor/Brain cross-fade every ~12s

### Core circle

| Property | Value |
|----------|-------|
| Size | `48×48px` (`3rem`) |
| Shape | `border-radius: 9999px` |
| Gradient | `135deg`: primary → `hsl(206 92% 42%)` → `hsl(206 92% 30%)` → primary at 85% |
| Background size | `200% 200%` (shimmer) |
| Icon | White, `24×24px`, stroke width `2.25` |
| Pressed | `:active` scale `0.94` on core |

### Core shadow (breathe animation)

| Phase | Box shadow |
|-------|------------|
| Rest | `0 6px 24px hsl(primary / 45%)`, `0 0 0 3px background` |
| Peak | `0 10px 32px hsl(primary / 60%)`, `0 0 0 3px background`, `0 0 20px hsl(primary / 35%)` |
| Scale | `1` → `1.05` → `1` over `3.2s`, ease-in-out, infinite |

### Nerve ring

| Property | Value |
|----------|-------|
| Position | `inset: -10px` around core |
| Border | `2px dotted`, primary at 55% opacity |
| Glow | `0 0 10px hsl(primary / 12%)` |
| Active | Border `2.5px`, primary at 75% opacity |

### Nerve impulse

| Property | Value |
|----------|-------|
| Type | Conic gradient wedge (~60° arc) |
| Mask | Radial gradient ring, ~3px stroke |
| Filter | `drop-shadow(0 0 5px hsl(primary / 45%))` |
| Animation | Rotate `360deg` / `8s` linear infinite |
| Active | Stronger glow, `6.5s` duration |

### Nerve nodes

| Property | Value |
|----------|-------|
| Count | 5 at `0°`, `72°`, `144°`, `216°`, `288°` |
| Size | `5×5px` |
| Radius | `24px` from center |
| Animation | Fire pulse synced with impulse, `8s` |

### Pulse rings

| Property | Value |
|----------|-------|
| Count | 2 (second delayed `1.4s`) |
| Border | `1px solid hsl(primary / 35%)` |
| Animation | Scale `1` → `1.55`, opacity `0.45` → `0`, `2.8s` ease-out |

### Icon cross-fade (12s cycle)

| Icon | Visible |
|------|---------|
| Monitor | ~0%–38%, ~94%–100% |
| Brain | ~44%–88% |
| Transition | Opacity + scale `0.82` ↔ `1` |

### Apps label spacing

| Tab type | Icon-to-label gap |
|----------|-------------------|
| Standard (Home, Feed, etc.) | `2px` (`gap-0.5`) |
| Apps (orb) | `10px` (`gap-2` + `mt-0.5`) |

Measure from bottom of **48×48px core**, not the outer nerve ring.

### Active orb modifiers (class `apps-orb-nav--active`)

| Element | Change |
|---------|--------|
| Core | Breathe/shimmer duration → `2.4s`, `3.5s` |
| Nerve track | Thicker, higher opacity border |
| Nerve impulse | Stronger drop-shadow, `6.5s` rotation |
| Nerve nodes | `6.5s` animation duration |

### Reduced motion

When `prefers-reduced-motion: reduce`:

- Disable all orb animations
- Show monitor icon only (brain hidden)
- Static core shadow (rest state)
- Hide nerve impulse; nodes at 45% opacity

---

## 8. Notification Badge

Used on tabs with unread counts (Notifications, Messages).

| Property | Value |
|----------|-------|
| Position | Top-right of icon: `-8px` right, `-6px` top (`-right-2 -top-1.5`) |
| Min size | `16×16px` (`min-w-[16px] h-4`) |
| Shape | Pill / circle |
| Background | Destructive red |
| Text | `9px` bold, white, centered |
| Padding | `4px` horizontal |
| Cap | `99+` when count > 99 |
| Poll interval | Every 15s |

---

## 9. Navigation Map

### Mobile dock tabs (`MOBILE_BOTTOM_NAV_ITEMS`)

| # | Label | Route | Type |
|---|-------|-------|------|
| 1 | Home | `/` | Standard link |
| 2 | Feed | `/feed` | Standard link |
| 3 | Apps | `/applications` | Center orb (`type: 'apps-orb'`) |
| 4 | Notifications | `/notifications` | Standard link + badge |
| 5 | More | — | Bottom sheet trigger (`type: 'more'`) |

**Active matching:**

- Apps: `/applications` or `/applications/*`
- More: active when current path matches any More sheet route

### Desktop dock tabs (`buildDesktopNavItems`)

| Label | Route | Badge |
|-------|-------|-------|
| Dashboard | `/` | |
| People | `/people`, `/people/:id` | |
| Organization | `/organization`, `/organization/*` | |
| Feed | `/feed` | |
| Messages | `/messages`, `/messages/*` | messages |
| Analytics | `/analytics`, `/analytics/*` | conditional |
| Application | `/applications`, `/applications/*` | |
| Notifications | `/notifications` | notifications |
| Activity | `/activity` | |
| Network | `/network-health` | |
| Attendance | `/attendance` | |
| Calendar | `/calendar` | |
| Broadcast | `/admin/broadcast` | admin only |
| Events | `/admin/events` | admin only |
| Users | `/admin/users` | admin only |
| Settings | `/settings` | |

**Analytics tab** shown when `user.role === 'admin'` OR Metabase dashboards exist.

### More menu — mobile bottom sheet (`buildMobileMoreItems`)

Triggered by **More** tab. Not part of dock chrome.

| Property | Value |
|----------|-------|
| Sheet position | Bottom, `rounded-t-2xl`, max-height `85dvh` |
| Overlay | `rgba(0, 0, 0, 0.25)` + `backdrop-blur-sm` |
| Panel | `glassPanelStyles` (same family as dock, readable on sheet) |
| Grid | `grid-cols-4 sm:grid-cols-5`, gap `4px` |
| Item layout | Icon + `11px` label, `rounded-xl py-3` |
| Active item | `bg-primary/15 text-primary` |
| Footer | Dark mode toggle (`ThemeToggle variant="switch"`) |
| Admin section | Separate labeled group when admin |

**Routes (regular):**

| Label | Route | Badge |
|-------|-------|-------|
| People | `/people` | |
| Organization | `/organization` | |
| Messages | `/messages` | messages |
| Analytics | `/analytics` | conditional |
| Activity | `/activity` | |
| Network | `/network-health` | |
| Attendance | `/attendance` | |
| Calendar | `/calendar` | |
| Profile | `/profile` | |
| Settings | `/settings` | |

**Routes (admin):** Broadcast, Events, Users (same paths as desktop admin tabs).

---

## 10. Wireframes

### Mobile

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

### Desktop / tablet

```
┌─────────────────────────────────────────────────────────────────┐
│  [Search……………………]              🌙  🔔  Avatar ▾                 │  TopBar
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                     Main page content                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │▬│ Dash │ People │ Org │ Feed │ Msg⁽¹⁾│ App │ Notif⁽²⁾│ … │→│
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
   ↑ active bar                              ↑ scroll when overflow
```

---

## 11. Figma / Design Tool Checklist

### Mobile frame (`390×844`, dark `#0A0E17`)

- [ ] Dock: `366×68px` (512px max − 24px inset), radius `16px`, glass fill + blur
- [ ] 5-column auto-layout; center column taller (orb overflow)
- [ ] Variants: inactive / active / pressed per tab
- [ ] Orb component: pulse, nerve ring, gradient, icon cross-fade
- [ ] Safe area: `12px` + home indicator inset
- [ ] Badge on Notifications
- [ ] More sheet variant (grid + theme footer)

### Desktop frame (`1440×900`)

- [ ] Dock: `h-64px`, full-width scroll container, no max-width cap
- [ ] 12–15 tabs, `min-width 72px` each, no orb
- [ ] TopBar with search, theme, bell, avatar
- [ ] Hidden scrollbar state
- [ ] Main content bottom padding `84px + safe area`

### Shared

- [ ] Light + dark mode glass tokens
- [ ] Active top pill indicator
- [ ] `prefers-reduced-motion` orb fallback

---

## 12. CSS Custom Properties

```css
:root {
  --nav-primary: 206 92% 36%;
  --nav-primary-hex: #0878B6;
  --nav-bg-dark: 222 47% 6%;
  --nav-card-dark: 222 47% 9%;
  --nav-muted-fg-dark: 220 9% 56%;
  --nav-fg-dark: 220 14% 96%;

  --dock-height-mobile: 4.25rem;   /* 68px */
  --dock-height-desktop: 4rem;     /* 64px */
  --dock-radius: 1rem;             /* 16px */
  --dock-max-width: 32rem;         /* 512px — mobile only */
  --dock-side-inset: 0.75rem;      /* 12px */
  --main-pb-dock: 5.25rem;         /* 84px — content clearance */
  --nav-icon-size: 1.25rem;        /* 20px */
  --nav-label-size: 0.625rem;      /* 10px */
  --nav-active-bar-w: 2rem;        /* 32px */
  --nav-active-bar-h: 0.125rem;    /* 2px */
  --nav-item-min-w-desktop: 4.5rem; /* 72px */
  --orb-size: 3rem;                /* 48px */
  --orb-lift: 1.5rem;              /* 24px above dock (-mt-6) */
  --orb-label-gap: 0.5rem;         /* 8px flex gap */
  --orb-label-margin-top: 0.125rem;/* 2px extra */
  --orb-label-total-gap: 0.625rem; /* 10px orb bottom → "Apps" text */
  --nav-standard-icon-label-gap: 0.125rem; /* 2px */
  --breakpoint-mobile-max: 767px;  /* mobile = max-width 767px */
}
```

Requires CSS variables `--primary`, `--primary-foreground`, `--background` (HSL channels without `hsl()` wrapper).

---

## 13. Apps Orb CSS (copy-paste)

Full animation block from `frontend/src/index.css`. Include when porting to another codebase.

```css
@keyframes apps-orb-breathe {
  0%, 100% {
    transform: scale(1);
    box-shadow:
      0 6px 24px hsl(var(--primary) / 0.45),
      0 0 0 3px hsl(var(--background));
  }
  50% {
    transform: scale(1.05);
    box-shadow:
      0 10px 32px hsl(var(--primary) / 0.6),
      0 0 0 3px hsl(var(--background)),
      0 0 20px hsl(var(--primary) / 0.35);
  }
}

@keyframes apps-orb-shimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes apps-orb-pulse {
  0% { transform: scale(1); opacity: 0.45; }
  100% { transform: scale(1.55); opacity: 0; }
}

@keyframes apps-orb-nerve-impulse {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes apps-orb-nerve-node-fire {
  0%, 82%, 100% {
    opacity: 0.35;
    box-shadow: 0 0 0 hsl(var(--primary) / 0);
    background-color: hsl(var(--primary) / 0.45);
  }
  90%, 94% {
    opacity: 1;
    box-shadow:
      0 0 6px hsl(var(--primary)),
      0 0 3px hsl(var(--primary-foreground) / 0.75);
    background-color: hsl(var(--primary-foreground));
  }
}

@keyframes apps-orb-icon-monitor {
  0%, 38% { opacity: 1; transform: scale(1); }
  44%, 48% { opacity: 0; transform: scale(0.82); }
  52%, 88% { opacity: 0; transform: scale(0.82); }
  94%, 100% { opacity: 1; transform: scale(1); }
}

@keyframes apps-orb-icon-brain {
  0%, 38% { opacity: 0; transform: scale(0.82); }
  44%, 48% { opacity: 1; transform: scale(1); }
  52%, 88% { opacity: 1; transform: scale(1); }
  94%, 100% { opacity: 0; transform: scale(0.82); }
}

.apps-orb-nav__core {
  position: relative;
  z-index: 2;
  display: flex;
  height: 3rem;
  width: 3rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: linear-gradient(
    135deg,
    hsl(var(--primary)) 0%,
    hsl(206 92% 42%) 35%,
    hsl(206 92% 30%) 70%,
    hsl(var(--primary) / 0.85) 100%
  );
  background-size: 200% 200%;
  animation:
    apps-orb-breathe 3.2s ease-in-out infinite,
    apps-orb-shimmer 5s ease-in-out infinite;
  transition: transform 0.15s ease;
}

.apps-orb-nav:active .apps-orb-nav__core {
  transform: scale(0.94);
}

.apps-orb-nav__icon {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.apps-orb-nav__icon--monitor {
  animation: apps-orb-icon-monitor 12s ease-in-out infinite;
}

.apps-orb-nav__icon--brain {
  animation: apps-orb-icon-brain 12s ease-in-out infinite;
}

.apps-orb-nav__nerve {
  pointer-events: none;
  position: absolute;
  inset: -10px;
  z-index: 1;
}

.apps-orb-nav__nerve-track,
.apps-orb-nav__nerve-impulse {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
}

.apps-orb-nav__nerve-track {
  border: 2px dotted hsl(var(--primary) / 0.55);
  box-shadow: 0 0 10px hsl(var(--primary) / 0.12);
}

.apps-orb-nav__nerve-impulse {
  background: conic-gradient(
    from 0deg,
    transparent 0deg 235deg,
    hsl(var(--primary) / 0.12) 235deg 265deg,
    hsl(var(--primary) / 0.55) 265deg 285deg,
    hsl(var(--primary-foreground) / 0.95) 285deg 295deg,
    hsl(var(--primary) / 0.55) 295deg 315deg,
    hsl(var(--primary) / 0.12) 315deg 335deg,
    transparent 335deg 360deg
  );
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 2px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 2px));
  filter: drop-shadow(0 0 5px hsl(var(--primary) / 0.45));
  animation: apps-orb-nerve-impulse 8s linear infinite;
}

.apps-orb-nav__nerve-node {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  margin-top: -2.5px;
  margin-left: -2.5px;
  border-radius: 9999px;
  transform: rotate(var(--nerve-angle)) translateX(24px);
  animation: apps-orb-nerve-node-fire 8s linear infinite;
  animation-delay: var(--nerve-delay);
}

.apps-orb-nav__pulse {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 9999px;
  border: 1px solid hsl(var(--primary) / 0.35);
  animation: apps-orb-pulse 2.8s ease-out infinite;
}

.apps-orb-nav__pulse--delayed {
  animation-delay: 1.4s;
}

.apps-orb-nav--active .apps-orb-nav__core {
  animation-duration: 2.4s, 3.5s;
}

.apps-orb-nav--active .apps-orb-nav__nerve-track {
  border-color: hsl(var(--primary) / 0.75);
  border-width: 2.5px;
}

.apps-orb-nav--active .apps-orb-nav__nerve-impulse {
  filter: drop-shadow(0 0 8px hsl(var(--primary) / 0.6));
  animation-duration: 6.5s;
}

.apps-orb-nav--active .apps-orb-nav__nerve-node {
  animation-duration: 6.5s;
}

@media (prefers-reduced-motion: reduce) {
  .apps-orb-nav__core,
  .apps-orb-nav__nerve-impulse,
  .apps-orb-nav__nerve-node,
  .apps-orb-nav__pulse,
  .apps-orb-nav__icon--monitor,
  .apps-orb-nav__icon--brain {
    animation: none;
  }

  .apps-orb-nav__icon--monitor {
    opacity: 1;
    transform: none;
  }

  .apps-orb-nav__icon--brain {
    opacity: 0;
    transform: none;
  }

  .apps-orb-nav__nerve-impulse {
    opacity: 0;
  }

  .apps-orb-nav__nerve-node {
    opacity: 0.45;
    box-shadow: none;
  }

  .apps-orb-nav__core {
    box-shadow:
      0 6px 24px hsl(var(--primary) / 0.45),
      0 0 0 3px hsl(var(--background));
  }
}
```

---

## 14. Implementation Pseudocode

```jsx
const MOBILE_BREAKPOINT = 768;
const isMobile = window.innerWidth < MOBILE_BREAKPOINT;

const navItems = isMobile
  ? MOBILE_BOTTOM_NAV_ITEMS   // 5 items incl. orb + more
  : buildDesktopNavItems({ showAnalytics, isAdmin });

// Outer nav shell — same for both
<nav className="fixed bottom-0 inset-x-0 z-40 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
  <div className="flex justify-center px-3 sm:px-4">
    <div className={cn(
      'flex items-stretch px-1 rounded-2xl border glassPanelStyles',
      isMobile
        ? 'h-[4.25rem] w-full max-w-lg overflow-visible'
        : 'h-16 w-fit max-w-full overflow-x-auto [scrollbar-width:none] ...'
    )}>
      {navItems.map(renderNavItem)}
    </div>
  </div>
</nav>

// Main content
<main className={showBottomNav ? 'pb-[calc(5.25rem+env(safe-area-inset-bottom))]' : ''} />
```

**Do not** render `AppsOrbNavItem` when `!isMobile`. **Do not** render `MobileMoreMenu` on desktop.

---

## 15. Design Principles

1. **Floating, not flush** — dock sits inset from screen edges
2. **Glass morphism** — blur + low-opacity fill, not a solid bar
3. **One hero action (mobile only)** — center orb draws attention to Apps
4. **Minimal labels** — 10px text; icons carry most meaning
5. **Subtle active cue** — thin top bar, not a full background fill
6. **Dark-first** — navy UI with blue accent; light mode via same tokens
7. **Progressive density** — mobile consolidates into More sheet; desktop exposes all routes

---

## 16. Visibility Rules

| Condition | Bottom nav | TopBar |
|-----------|------------|--------|
| Standard pages | Shown | Shown |
| `/applications/:id/view` (embedded app) | **Hidden** | **Hidden** |
| Mobile (`< 768px`) | 5-tab dock + orb | Search only |
| Desktop / tablet (`≥ 768px`) | Scroll dock, all tabs | Search + theme + bell + profile |

**Badge polling:** Messages and notifications refresh every 15 seconds.

**Embedded app regex:** `/^\/applications\/\d+\/view$/`
