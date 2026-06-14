# Nexus Design Template

**Single source of truth** for building pages, features, and integrated systems inside **EMZI Nexus Brain**. Follow this document exactly so every system looks and behaves identically to Nexus.

> When code changes, update this file to match. Reference implementation lives in `frontend/src/`.

---

## Table of contents

1. [Design principles](#1-design-principles)
2. [Tech stack & project structure](#2-tech-stack--project-structure)
3. [Color system & tokens](#3-color-system--tokens)
4. [Typography](#4-typography)
5. [Z-index layer map](#5-z-index-layer-map)
6. [Layout & spacing](#6-layout--spacing)
7. [Navigation](#7-navigation)
8. [Theme system](#8-theme-system)
9. [Auth page template](#9-auth-page-template)
10. [UI components (shadcn/ui)](#10-ui-components-shadcnui)
11. [Overlays: dialog, sheet, drawer, dropdown](#11-overlays-dialog-sheet-drawer-dropdown)
12. [Forms & inputs](#12-forms--inputs)
13. [Profile, people & dashboard patterns](#13-profile-people--dashboard-patterns)
14. [Widgets](#14-widgets)
15. [Notifications & broadcasts](#15-notifications--broadcasts)
16. [Application / system tiles & browser](#16-application--system-tiles--browser)
17. [Empty, loading & error states](#17-empty-loading--error-states)
18. [Toasts (Sonner)](#18-toasts-sonner)
19. [Tables & pagination](#19-tables--pagination)
20. [Motion & interaction](#20-motion--interaction)
21. [Dark mode](#21-dark-mode)
22. [Responsive behavior & breakpoints](#22-responsive-behavior--breakpoints)
23. [Scrollbar & global CSS](#23-scrollbar--global-css)
24. [PWA, meta & splash screen](#24-pwa-meta--splash-screen)
25. [Hardcoded color exceptions](#25-hardcoded-color-exceptions)
26. [Standard page templates](#26-standard-page-templates)
27. [Icon sizing reference](#27-icon-sizing-reference)
28. [Pre-ship checklist](#28-pre-ship-checklist)
29. [Reference files](#29-reference-files)

---

## 1. Design principles

| Principle | Rule |
|-----------|------|
| **Consistency** | Shared tokens, shadcn/ui components, Lucide icons only. No one-off UI libraries. |
| **Clarity** | One primary action per section. Labels above inputs. Every page has title + description. |
| **Responsive first** | Mobile: cards, collapsible filters, bottom nav. Desktop: toolbars, multi-column grids. |
| **Accessible** | Semantic HTML, `aria-label` on icon-only buttons, focus via `ring-ring`, contrast in both themes. |
| **Subtle motion** | Framer Motion entrances; hover ≤ 300ms. Never block interaction with animation. |
| **Token-first** | Use `bg-card`, `text-foreground`, etc. Never raw `slate-*` or `bg-white` in app pages (see §25 for exceptions). |

---

## 2. Tech stack & project structure

| Layer | Choice |
|-------|--------|
| Framework | React 18 + React Router |
| Build | Vite |
| Styling | Tailwind CSS 3 + CSS variables |
| Components | shadcn/ui — **New York** style (`components.json`) |
| Icons | Lucide React |
| Animation | Framer Motion |
| Toasts | Sonner |
| Theme | next-themes |
| Data | TanStack Query |
| Forms | Native + shadcn Form (where used) |

### Import aliases (`components.json`)

| Alias | Path |
|-------|------|
| `@/components/ui/*` | shadcn primitives |
| `@/components/*` | App components |
| `@/lib/utils` | `cn()` helper |
| `@/hooks/*` | Shared hooks |
| `@/lib/*` | Utilities, contexts |

### Required global setup

```jsx
// App.jsx root
<ThemeProvider>
  <QueryClientProvider>
    <AuthProvider>
      <RouterProvider />
      <Toaster />
    </AuthProvider>
  </QueryClientProvider>
</ThemeProvider>
```

---

## 3. Color system & tokens

All colors are HSL CSS variables in `frontend/src/index.css`, mapped in `frontend/tailwind.config.js`.

**Rule:** Use Tailwind semantic classes (`bg-primary`, `text-muted-foreground`). Never hardcode hex except application brand colors (§16) and documented exceptions (§25).

### 3.1 Core tokens — light mode

| Token | HSL | Tailwind | Usage |
|-------|-----|----------|-------|
| `--background` | `220 20% 97%` | `bg-background` | Page background |
| `--foreground` | `222 47% 11%` | `text-foreground` | Primary text |
| `--card` | `0 0% 100%` | `bg-card` | Cards, panels |
| `--card-foreground` | `222 47% 11%` | `text-card-foreground` | Text on cards |
| `--popover` | `0 0% 100%` | `bg-popover` | Dropdowns, popovers |
| `--primary` | `206 92% 36%` | `bg-primary` | Brand blue |
| `--primary-foreground` | `0 0% 100%` | `text-primary-foreground` | Text on primary |
| `--secondary` | `220 14% 96%` | `bg-secondary` | Secondary surfaces |
| `--muted` | `220 14% 96%` | `bg-muted` | Subtle backgrounds |
| `--muted-foreground` | `220 9% 46%` | `text-muted-foreground` | Secondary text |
| `--accent` | `220 14% 96%` | `bg-accent` | Hover states |
| `--destructive` | `0 84% 60%` | `bg-destructive` | Errors, delete |
| `--border` | `220 13% 91%` | `border-border` | Borders |
| `--input` | `220 13% 91%` | `border-input` | Input borders |
| `--ring` | `206 92% 36%` | `ring-ring` | Focus rings |

### 3.2 Core tokens — dark mode

| Token | HSL |
|-------|-----|
| `--background` | `222 47% 6%` |
| `--foreground` | `220 14% 96%` |
| `--card` | `222 47% 9%` |
| `--primary` | `206 92% 36%` (unchanged) |
| `--secondary` | `222 40% 14%` |
| `--muted` | `222 40% 14%` |
| `--muted-foreground` | `220 9% 56%` |
| `--destructive` | `0 62% 30%` |
| `--border` | `222 40% 16%` |
| `--input` | `222 40% 16%` |

### 3.3 Semantic tokens (both themes)

| Token | HSL | Usage |
|-------|-----|-------|
| `--success` | `160 84% 39%` | Online, healthy, confirmed |
| `--warning` | `38 92% 50%` | Degraded, maintenance |
| `--info` | `210 71% 35%` | Informational |
| `--critical` | `330 80% 55%` | Critical alerts |

Usage: `text-success`, `bg-warning/10`, `border-destructive/30`, etc.

### 3.4 Sidebar tokens (legacy sidebar component)

| Token | Light | Dark |
|-------|-------|------|
| `--sidebar-background` | `222 47% 11%` | `222 47% 6%` |
| `--sidebar-foreground` | `220 14% 80%` | same |
| `--sidebar-primary` | `206 92% 36%` | same |
| `--sidebar-accent` | `222 40% 16%` | `222 40% 12%` |
| `--sidebar-border` | `222 40% 18%` | `222 40% 12%` |

Tailwind: `bg-sidebar`, `text-sidebar-foreground`, etc.

### 3.5 Chart tokens

`--chart-1` through `--chart-5` — mapped to `chart.1` … `chart.5` in Tailwind. Use for Recharts / chart components.

### 3.6 Brand panel (auth pages only)

Fixed deep blue — **not** theme tokens:

| Element | Value |
|---------|-------|
| Base | `bg-[hsl(206,92%,15%)]` |
| Gradient | `from-[hsl(206,92%,25%)] via-[hsl(206,92%,20%)] to-[hsl(206,92%,10%)]` |
| Decorative blurs | `bg-primary/20`, `bg-primary/10` |
| Concentric rings | `border border-white/5` circles |
| Text | `text-white`, `text-white/60`, `text-white/50` |
| Feature chips | `px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-medium ring-1 ring-white/10` |
| Avatar stack (decorative) | `w-7 h-7 rounded-full border-2 border-white/20` |

### 3.7 Border radius

| Token / class | Value | Usage |
|---------------|-------|-------|
| `--radius` | `0.75rem` (12px) | Base; drives `rounded-lg/md/sm` |
| `rounded-3xl` | 24px | Auth mobile card |
| `rounded-2xl` | 16px | Cards, dock, widgets |
| `rounded-xl` | 12px | App tiles, alert banners, list rows |
| `rounded-lg` | ~10px | Avatars (square), icon boxes, nav triggers |
| `rounded-md` | ~8px | Buttons, inputs, badges |
| `rounded-full` | 50% | Dots, circular badges, profile on auth |

---

## 4. Typography

### 4.1 Font families

```css
--font-sans: 'Inter', system-ui, sans-serif;   /* weights 300–900 */
--font-mono: 'JetBrains Mono', monospace;        /* weights 400–600 */
```

Loaded via Google Fonts in `index.css`. Body: `font-sans` (applied globally).

### 4.2 Type scale

| Element | Classes |
|---------|---------|
| Page title (desktop) | `text-2xl font-bold tracking-tight` |
| Page title (mobile) | `text-xl font-bold tracking-tight` |
| Page description | `text-sm text-muted-foreground mt-1` |
| Card / section title | `text-base font-semibold` or `CardTitle` |
| Card description | `text-sm text-muted-foreground` |
| Widget title | `font-semibold text-sm` |
| Form label | `text-sm font-medium text-foreground` |
| Filter label | `text-xs text-muted-foreground mb-1 block` |
| Helper / caption | `text-xs text-muted-foreground` |
| Stats label | `text-xs font-medium text-muted-foreground uppercase tracking-wider` |
| Stats value | `text-3xl font-bold tracking-tight` |
| Bottom nav label | `text-[10px] font-medium leading-none` |
| Date / meta line | `text-[11px] sm:text-xs text-muted-foreground` |
| Admin section label | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` |
| Group header (notifications) | `text-xs font-semibold uppercase tracking-wider` |
| Keyboard hint | `font-mono text-[10px]` |
| Badge (compact) | `text-[10px]` or `text-[9px]` |
| Hero name (profile) | `text-lg sm:text-3xl font-bold tracking-tight` |
| Auth mobile title | `text-3xl font-bold tracking-tight text-center` |
| Auth desktop title | `text-2xl font-bold tracking-tight` |
| 404 number | `text-7xl font-light` (PageNotFound only — legacy) |

### 4.3 Page title pattern (required)

```jsx
<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
  <SomeIcon className="w-6 h-6 text-primary" />
  Page Title
</h1>
<p className="text-sm text-muted-foreground mt-1">
  One-line description.
</p>
```

Analytics mobile variant: icon `w-5 h-5 sm:w-6 sm:h-6`.

---

## 5. Z-index layer map

Use these layers consistently. Do not invent new z-index values without updating this table.

| z-index | Component / usage |
|---------|-------------------|
| `z-[9999]` | PWA splash screen |
| `z-[120]` | Mention autocomplete popover |
| `z-50` | Dialogs, sheets, drawers, dropdowns, selects, notification panel backdrop + panel, PWA install prompt |
| `z-40` | BottomNav |
| `z-[25]` | GlobalBroadcastStrip (fixed below TopBar) |
| `z-30` | TopBar, AppLayout header stack |
| `z-20` | Auth theme toggle, cover photo controls, app card launch overlay |
| `z-10` | Sticky table headers, drag overlays, corner ribbon |
| `z-[3]` | CornerRibbon on app tiles |
| `z-[2]` | App card admin overlay |
| `z-[1]` | App card logo layer |

---

## 6. Layout & spacing

### 6.1 App shell

```
┌─────────────────────────────────────────────┐
│  TopBar (h-16, z-30, glass panel)           │
│  [Optional] GlobalBroadcastStrip (z-25)     │
├─────────────────────────────────────────────┤
│  main                                       │
│  ┌─────────────────────────────────────┐    │
│  │  max-w-[1600px] mx-auto             │    │
│  │  p-4 sm:p-6                         │    │
│  │  { page content: space-y-6 }        │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  BottomNav (z-40, glass dock)              │
└─────────────────────────────────────────────┘
```

### 6.2 Spacing tokens

| Property | Value |
|----------|-------|
| Max content width | `max-w-[1600px] mx-auto w-full` |
| Page padding | `p-4 sm:p-6` |
| Section vertical gap | `space-y-6` |
| Grid gap | `gap-6` (dashboard), `gap-4` (stats/filters), `gap-3` (compact grids) |
| Card internal padding | `p-5` (stats), `p-6` (CardHeader/Content default) |
| Widget header | `p-5 pb-3` |
| Top bar height | `h-16` (4rem) |
| Top padding (main) | `pt-16` |
| Top padding + broadcast | `pt-[calc(4rem+1.75rem)] sm:pt-21` |
| Bottom nav clearance | `pb-[calc(4.75rem+env(safe-area-inset-bottom))]` |

### 6.3 Layout variants

| Variant | Route / condition | Behavior |
|---------|-------------------|----------|
| **Standard** | Most pages | TopBar + padding + bottom nav |
| **Full bleed** | `/applications/:id/view` | No TopBar, no padding, no bottom nav, no broadcast |
| **Analytics** | `/analytics` | `h-[100dvh] max-h-[100dvh] overflow-hidden`; flex column container |
| **Auth** | `/login`, `/register`, etc. | No app shell; standalone full-screen |

### 6.4 Grid patterns

| Pattern | Classes |
|---------|---------|
| Dashboard 3-column | `grid grid-cols-1 xl:grid-cols-12 gap-6` → `xl:col-span-3 / 6 / 3` |
| Profile 2-column | `grid grid-cols-1 xl:grid-cols-12 gap-6` → sidebar `xl:col-span-4`, main `xl:col-span-8` |
| Mobile reorder | Parent: `max-xl:contents`; children: `order-N xl:order-none` |
| Stats row | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` |
| People grid | Responsive card grid with `gap-4` or `gap-6` |
| Filter bar | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3` |
| People filter (advanced) | `lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]` |
| Application form picker | `grid grid-cols-1 sm:grid-cols-3 gap-3` |

### 6.5 Page header + actions

```jsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>{/* title + description */}</div>
  <Button variant="outline" className="gap-2 shrink-0">
    <Icon className="w-4 h-4" /> Action
  </Button>
</div>
```

Mobile primary CTA: `h-10 w-full sm:w-auto sm:h-9`.

---

## 7. Navigation

### 7.0 Glass panel tokens

**File:** `glassStyles.js`

Shared frosted-glass surface used by TopBar (§7.1), mobile sidebar sheet (§7.3), and bottom dock (§7.4 via `glassDockStyles`).

#### Base styles (`glassPanelStyles`)

| Setting | Light | Dark |
|---------|-------|------|
| Blur | `backdrop-blur-2xl` | same |
| Background | `bg-card/30` | `bg-card/35` |
| Border color | `border-border/50` | `border-border/70` |
| Shadow | `shadow-[0_8px_24px_rgba(0,0,0,0.08)]` | `shadow-[0_8px_32px_rgba(0,0,0,0.4)]` |
| Ring | `ring-1 ring-black/5` | `ring-white/10` |

**Import:** `import { glassPanelStyles } from '@/components/layout/glassStyles';`

**Usage:** Apply via `cn(glassPanelStyles, …)` and add edge-specific borders as needed (`border-b`, `border-r`, `border`).

| Component | Additional classes |
|-----------|-------------------|
| TopBar (§7.1) | `border-b` |
| Mobile more menu sheet (§7.3) | `border-r shadow-2xl` |
| Bottom dock (§7.4) | `glassDockStyles` = base + `rounded-2xl border` |

### 7.1 Top bar

**File:** `TopBar.jsx`

| Property | Value |
|----------|-------|
| Height | `h-16` |
| Background | `glassPanelStyles` + `border-b` (see §7.0) |
| Padding | `px-6` |
| Position | Embedded in AppLayout stack (`embedded` prop): `w-full`. Legacy fixed: `fixed top-0 right-0 z-30` |
| Transition | `transition-all duration-200` |

**Left:** MobileMoreMenu (mobile) + GlobalSearchTrigger (flex-1)

**Right desktop:** ThemeToggle (icon) → Notification bell → Avatar dropdown

**Right mobile:** ThemeToggle (icon) only

**Notification bell button:** `p-2 rounded-lg hover:bg-muted transition-colors`

**Bell badge (desktop):** `absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold animate-pulse` — capped `99+`

**Avatar dropdown trigger:** `flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors`

**Avatar:** `h-8 w-8 rounded-lg` (square corners — see §10.8)

**Avatar fallback:** `rounded-lg bg-primary/10 text-sm font-semibold text-primary`

**User name (md+):** `text-sm font-medium leading-none`; role: `text-xs text-muted-foreground`

**Dropdown:** `align="end" w-48`; sign out item: `text-destructive`

**NotificationPanel:** Desktop only (`!isMobile`). Polls unread every 15s (excludes broadcasts + DMs).

### 7.2 Global search

**File:** `GlobalSearch.jsx`

**Trigger (`GlobalSearchTrigger`):**

```
relative flex w-full items-center rounded-lg bg-muted/50 pl-9 pr-3 h-10
text-sm text-left text-muted-foreground transition-colors
hover:bg-muted/70 focus-visible:ring-1 focus-visible:ring-ring
```

- Search icon: `absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2`
- Keyboard hint (desktop): `kbd` with `h-5 rounded border bg-muted px-1.5 font-mono text-[10px]` showing `⌘K`
- Shortcut: `(metaKey|ctrlKey) + k` via `useGlobalSearchShortcut`

**Dialog:** `CommandDialog` with `shouldFilter={false}`, debounce 250ms

**Shell:** `w-[calc(100%-2rem)] max-w-lg rounded-xl p-0`; input area `h-12`; list `max-h-[300px]`

**Empty states:**
- Idle: "Type a name or email to search."
- Loading: `Loader2 h-4 w-4 animate-spin` + "Searching..."
- No results: "No users found."

**Result row:** `UserAvatar h-8 w-8`; name `truncate font-medium`; dept `text-xs text-muted-foreground`; role badge `variant="secondary" capitalize shrink-0 text-[10px]`

### 7.3 Mobile more menu

**File:** `MobileMoreMenu.jsx`

**Trigger:** `p-2 rounded-lg hover:bg-muted`; `Menu w-5 h-5 text-muted-foreground`

**Sheet:** `side="left"`, `hideCloseButton`, `w-[280px]`, `flex flex-col border-r p-0 shadow-2xl` + `glassPanelStyles` (see §7.0)

**Overlay:** `bg-black/25 backdrop-blur-sm` (lighter than default `bg-black/80`)

**Header:** `border-b border-border/50 px-4 py-4`; logo `h-9 w-9 rounded-xl`; title `text-base font-bold tracking-tight`

**Nav links:**

| State | Classes |
|-------|---------|
| Active | `bg-primary/15 text-primary` |
| Inactive | `text-foreground hover:bg-foreground/5` |
| Layout | `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors` |
| Icon | `h-5 w-5 shrink-0` |
| Label | `text-sm font-medium` |

**Admin section label:** `px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground`

**Footer:** `mt-auto border-t border-border/50 p-4` with icon box + `ThemeToggle variant="switch"`

**Items:** People, Company Feed, Messages, Activity Feed, Calendar, Network Health, Settings; admin: Broadcast, System Events, User Management.

### 7.4 Bottom navigation (glass dock)

**Files:** `BottomNav.jsx`, `glassStyles.js`, `navItems.js`, `AppLayout.jsx`

#### Visual structure

```
┌─────────────────────────────────────┐
│           Page content              │
├─────────────────────────────────────┤
│   ┌─────────────────────────────┐   │  ← glass dock (rounded-2xl)
│   │  icon + label per item      │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
         safe-area padding
```

#### Glass dock styles (`glassDockStyles`)

Built from `glassPanelStyles` (§7.0) + `rounded-2xl border`.

#### Layout & sizing

| Property | Value |
|----------|-------|
| Position | `fixed bottom-0 left-0 right-0 z-40` |
| Outer padding | `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` |
| Horizontal inset | `px-3 sm:px-4`, centered |
| Dock height | `h-16` |
| Mobile width | `w-full max-w-lg` |
| Desktop width | `w-fit max-w-full overflow-x-auto` (hidden scrollbar) |

#### Nav item states

| State | Spec |
|-------|------|
| Layout | `relative flex flex-col items-center justify-center gap-0.5 transition-colors` |
| Active | `text-primary`; top bar: `absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary` |
| Inactive | `text-muted-foreground hover:text-foreground` |
| Icon | `h-5 w-5` |
| Label | `text-[10px] font-medium leading-none` |
| Mobile width | `flex-1 px-1` |
| Desktop width | `min-w-[4.5rem] shrink-0 px-2` |

#### Badge counts

```
absolute -right-2 -top-1.5 min-w-[16px] h-4 rounded-full
bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground
```

Poll every 15s. Cap at `99+`.

#### Mobile nav items (6 max)

Home `/`, Feed `/feed`, Analytics `/analytics`, Apps `/applications`, Notifications `/notifications` (badge), Profile `/profile`

#### Desktop nav items

Dashboard, People, Feed, Messages (badge), Analytics (conditional), Application, Notifications (badge), Activity, Network, Calendar, Broadcast/Events/Users (admin), Settings

**Breakpoint:** `< 768px` = mobile (`useIsMobile()`)

#### Visibility

| Condition | Bottom nav |
|-----------|------------|
| Standard pages | Shown |
| `/applications/:id/view` | Hidden |

---

## 8. Theme system

**Files:** `ThemeProvider.jsx`, `ThemeToggle.jsx`, `index.html` FOUC script

### ThemeProvider config

```jsx
<NextThemesProvider
  attribute="class"
  defaultTheme="light"
  enableSystem={false}
  storageKey="nexus-theme"
  disableTransitionOnChange
/>
```

### FOUC prevention (`index.html`)

```html
<script>
  try {
    if (localStorage.getItem('nexus-theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
</script>
```

### ThemeToggle variants

| Variant | Component | Usage |
|---------|-----------|-------|
| `icon` (default) | `Button ghost icon h-9 w-9`; Sun/Moon `h-5 w-5` | TopBar, auth pages |
| `switch` | `Switch checked={isDark}` | Settings, MobileMoreMenu footer |

**Pre-mount placeholder:** Disabled button or switch (prevents hydration mismatch)

**Auth TopBar toggle classes:** `text-white lg:text-foreground hover:bg-white/10 lg:hover:bg-muted`

### Settings appearance row pattern

```jsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
      <Sun className="w-4 h-4 text-primary" />
    </div>
    <div>
      <Label className="text-sm font-medium">Dark Mode</Label>
      <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
    </div>
  </div>
  <ThemeToggle variant="switch" />
</div>
```

Semantic icon box backgrounds: `primary/10`, `info/10`, `warning/10`.

---

## 9. Auth page template

**Files:** `Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`

Split layout desktop (`lg:`). Full-screen branded mobile.

### 9.1 Structure

```
Desktop (lg+):
┌──────────────────┬──────────────────┐
│  Brand panel 50% │  Form panel 50%  │
│  Logo, hero,     │  Logo, form,     │
│  feature chips   │  links           │
└──────────────────┴──────────────────┘

Mobile:
┌──────────────────┐
│  Theme toggle    │  absolute top-4 right-4 z-20
│  Banner logo     │  /icons/banner.png full width
│  ┌────────────┐  │
│  │ White card │  │  bg-card rounded-3xl p-8 shadow-2xl
│  └────────────┘  │
│  Footer text     │  text-white/50 text-xs
└──────────────────┘
```

Root: `min-h-screen flex relative`

### 9.2 Form panel

| Element | Mobile | Desktop |
|---------|--------|---------|
| Panel bg | Blue gradient overlay | `lg:bg-background` |
| Form container | `bg-card rounded-3xl p-8 shadow-2xl space-y-6` | No card wrapper, `space-y-8` |
| Title | `text-3xl font-bold text-center tracking-tight` | `text-2xl font-bold tracking-tight` |
| Subtitle | `text-sm text-muted-foreground text-center` | `text-sm text-muted-foreground` |
| Input height | `h-12` | `h-11` |
| Input classes | `bg-background border-border/80 focus:ring-2 focus:ring-primary/20 focus:border-primary` | same |
| Submit button | `w-full h-12 font-semibold text-base shadow-md shadow-primary/20 hover:shadow-primary/30` | `w-full h-11 font-semibold text-sm` |
| Form spacing | `space-y-5` | `space-y-5` |
| Field spacing | `space-y-2` (mobile) / `space-y-1.5` (desktop) | |

### 9.3 Links

Primary link: `text-primary font-medium hover:text-primary/80 transition-colors`

Forgot password: `text-xs text-primary hover:text-primary/80 transition-colors font-medium`

### 9.4 Banners

**Error:** `rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3` + icon + `text-sm text-destructive`

**Warning (pending approval):** `rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/20` + `text-sm text-amber-700 dark:text-amber-400`

**Success:** `border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/20`

### 9.5 Password field

Input: `pr-10`; toggle button: `absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground`; icon `w-4 h-4`

### 9.6 Loading button state

Inline spinner SVG `w-4 h-4 animate-spin` + "Signing in…"

### 9.7 Auth bootstrap loading (`App.jsx`)

Full-screen centered: `w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin` — no app shell.

---

## 10. UI components (shadcn/ui)

Always import from `@/components/ui/*`. Style: **New York**. Base color: **neutral**. CSS variables: **enabled**.

### 10.1 Card

Default: `rounded-xl border bg-card text-card-foreground shadow`

**App standard:** add `rounded-2xl`

```jsx
<Card className="rounded-2xl">
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" /> Title
    </CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>{/* content */}</CardContent>
</Card>
```

**Stats card:** `bg-card rounded-2xl border border-border p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group`

**Destructive card:** `rounded-2xl border-destructive/20`

**Filter card:** `rounded-2xl border border-border bg-card p-4`

**Widget shell:** `bg-card rounded-2xl border border-border overflow-hidden`

### 10.2 Button

Base: `inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50`

| Variant | Classes |
|---------|---------|
| `default` | `bg-primary text-primary-foreground shadow hover:bg-primary/90` |
| `destructive` | `bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90` |
| `outline` | `border border-input bg-transparent shadow-sm hover:bg-accent` |
| `secondary` | `bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` |
| `link` | `text-primary underline-offset-4 hover:underline` |

| Size | Height |
|------|--------|
| `default` | `h-9 px-4` |
| `sm` | `h-8 px-3 text-xs` |
| `lg` | `h-10 px-8` |
| `icon` | `h-9 w-9` |

Primary CTA: add `shadow-md shadow-primary/20 hover:shadow-primary/30`

Destructive outline: `text-destructive border-destructive/30 hover:bg-destructive/10`

Compact widget button: `h-8 flex-1 text-xs`

### 10.3 Badge

Base: `inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold`

Compact: `text-[10px]` or `text-[9px]`

### 10.4 Input

`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground`

Read-only: `bg-muted/50 cursor-not-allowed`

Search with icon: `pl-9` + absolute `Search left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`

Muted search: `h-9 bg-muted/50 border-0`

### 10.5 Textarea

`min-h-[60px] rounded-md border border-input px-3 py-2 text-base md:text-sm shadow-sm focus-visible:ring-1`

### 10.6 Select

Trigger: `h-9 rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring`

Content: `z-50 max-h-96 rounded-md border bg-popover shadow-md`

Item: `rounded-sm py-1.5 pl-2 pr-8 text-sm focus:bg-accent`

Compact filter: `h-9 text-xs w-32` or `w-36`

### 10.7 Checkbox

`h-4 w-4 rounded-sm border border-primary`; checked: `bg-primary text-primary-foreground`

Auth remember me: `w-5 h-5 rounded border-border/80`

### 10.8 Switch

`h-5 w-9 rounded-full`; checked `bg-primary`, unchecked `bg-input`; thumb `h-4 w-4`, translates `translate-x-4` when checked

### 10.9 Avatar

Default primitive: `h-10 w-10 rounded-full`; fallback `bg-muted`

**App convention — square avatars in chrome:**

| Context | Size | Classes |
|---------|------|---------|
| TopBar | `h-8 w-8` | `rounded-lg`; fallback `bg-primary/10 text-sm font-semibold text-primary` |
| GlobalSearch result | `h-8 w-8` | round or default |
| People card | `h-12 w-12` | |
| UserAvatar default | `h-10 w-10` | fallback `bg-primary/10 text-sm font-semibold text-primary` |
| Profile hero | `h-32 w-32 sm:h-36 sm:w-36 lg:h-40 lg:w-40` | `border-[5px] border-background shadow-xl ring-1 ring-border` |
| Profile fallback letter | — | `text-2xl sm:text-3xl lg:text-4xl bg-primary/10 text-primary` |

### 10.10 Progress

Track: `h-2 w-full rounded-full bg-primary/20`

Indicator: `h-full bg-primary transition-all` (translateX transform)

### 10.11 Separator

`h-[1px] w-full bg-border` (horizontal)

### 10.12 Tooltip

`z-50 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground` — uses **primary** bg, not popover

`sideOffset={4}`

### 10.13 Skeleton

`animate-pulse rounded-md bg-primary/10` (not `bg-muted`)

### 10.14 Tabs

```jsx
<TabsList className="h-10">           {/* or h-9 for compact */}
  <TabsTrigger value="x" className="gap-2 flex-1 sm:flex-none">
    <Icon className="w-4 h-4" /> Label
  </TabsTrigger>
</TabsList>
<TabsContent value="x" className="space-y-6">
```

Filter tabs: `TabsList h-9 bg-muted/50`; triggers `text-xs flex-1`

### 10.15 Alert (shadcn)

`relative w-full rounded-lg border px-4 py-3 text-sm`

Destructive: `border-destructive/50 text-destructive`

---

## 11. Overlays: dialog, sheet, drawer, dropdown

### 11.1 Dialog (default)

- Overlay: `z-50 bg-black/80`
- Content: `max-w-lg p-6 shadow-lg sm:rounded-lg`
- Close: `absolute right-4 top-4 opacity-70`
- Animation: 200ms zoom/fade

### 11.2 Full-height form dialog (Applications CRUD)

```
DialogContent: sm:max-w-2xl h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col
DialogHeader:  px-6 pt-6 pb-3 border-b border-border/70
Scroll body:   flex-1 min-h-0 overflow-y-auto px-6 py-4
Footer:        px-6 py-4 border-t border-border/70 bg-background
```

Reorder dialog: `sm:max-w-lg p-0 gap-0 max-h-[85vh]`

Crop dialog: `sm:max-w-md`; crop area `h-64 rounded-lg bg-muted`

### 11.3 AlertDialog (destructive confirm)

Standard shadcn AlertDialog. Applications delete requires typing exact app name.

### 11.4 Sheet

- Default overlay: `bg-black/80`
- Open 500ms / close 300ms ease-in-out
- Left side: `w-3/4 sm:max-w-sm`
- Supports `overlayClassName`, `hideCloseButton`
- Mobile menu: `w-[280px]` + custom overlay `bg-black/25 backdrop-blur-sm`

### 11.5 Drawer (vaul)

Bottom sheet: `rounded-t-[10px]`; drag handle `mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted`

### 11.6 Dropdown

Content: `z-50 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md`; `sideOffset={4}`

Item: `rounded-sm px-2 py-1.5 text-sm gap-2`

### 11.7 Command / search dialog

See §7.2.

### 11.8 OpenModeSelector card picker

3-column grid; each option:

| State | Classes |
|-------|---------|
| Selected | `border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm` |
| Unselected | `border-border bg-card hover:bg-muted/30 hover:border-primary/40` |
| Preview wireframe | `h-14 rounded-lg border border-border/80 bg-muted/30` |

---

## 12. Forms & inputs

### 12.1 Standard field

```jsx
<div className="space-y-1.5">
  <Label htmlFor="field" className="text-sm font-medium">Label</Label>
  <Input id="field" placeholder="..." />
  <p className="text-xs text-muted-foreground">Helper text</p>
</div>
```

### 12.2 Settings switch-row (reusable)

```jsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div>
      <Label className="text-sm font-medium">Setting name</Label>
      <p className="text-xs text-muted-foreground">Description</p>
    </div>
  </div>
  <Switch checked={value} onCheckedChange={setValue} />
</div>
```

### 12.3 TagInput

Container: `min-h-10 rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2`

Tags: `Badge secondary text-xs`; inner input: `h-7 min-w-[8rem] border-0 shadow-none focus-visible:ring-0`

### 12.4 DepartmentCombobox

`Popover` + `Command shouldFilter={false}`; trigger `Button outline w-full justify-between font-normal`; create row with `Plus` icon.

### 12.5 Profile form patterns

- Tabs URL-driven: `?tab=security`
- Save button shows "Saved" when clean; "Discard changes" ghost when dirty
- Separator between logical sections
- Destructive sign-out: `text-destructive border-destructive/30 hover:bg-destructive/10`

### 12.6 Form spacing

| Context | Spacing |
|---------|---------|
| Auth form | `space-y-5` |
| Settings / profile | `space-y-6` |
| Dialog form | field groups `space-y-4` |

---

## 13. Profile, people & dashboard patterns

### 13.1 ProfileDashboardHero

**File:** `ProfileDashboardHero.jsx`

| Element | Spec |
|---------|------|
| Container | `bg-card rounded-2xl border border-border overflow-hidden shadow-sm` |
| Motion | `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}` |
| Cover aspect | `aspect-[3/2] sm:aspect-[5/2] lg:aspect-[4/1]` (`COVER_PHOTO_DISPLAY_ASPECT`) |
| Default cover | `/icons/cover-photo-new.png` |
| Cover gradient | `bg-gradient-to-t from-background/55 via-transparent to-transparent sm:from-background/75 sm:via-background/10` |
| Cover load skeleton | `absolute inset-0 bg-muted transition-opacity duration-300` |
| Avatar overlap | `-mt-[5.5rem] sm:-mt-20 lg:-mt-[5.5rem]` |
| Admin badge | default + `ShieldCheck w-3 h-3`; `h-5 text-[10px] sm:h-auto sm:text-xs` |
| Member badge | `variant="secondary" capitalize` |

### 13.2 ProfileAboutCard

- Bio block: `rounded-xl border border-border/80 bg-muted/20 p-4`
- Field row: icon `w-4 h-4` + label `text-xs text-muted-foreground` + value `font-medium`
- Skill badges: `variant="secondary" text-[10px] font-medium`
- Strength panel: `Progress h-2`; checklist done `Check w-3.5 h-3.5 text-primary`, todo `Circle w-3.5 h-3.5 text-muted-foreground/50`
- Complete CTA: `Button outline sm w-full gap-2 h-8 text-xs`

### 13.3 Profile uploaders

**Overlay hover (desktop):** `absolute inset-0 hidden sm:flex rounded-full bg-background/60 opacity-0 group-hover:opacity-100` + `Camera w-6 h-6`

**Mobile camera button:** `h-8 w-8 rounded-full border border-border/70 bg-background shadow-md`

**Crop dialog:** `Cropper aspect={1} cropShape="round"`; zoom `min={1} max={3} step={0.05}`

Cover crop: desktop 4:1; mobile preview 3:2

### 13.4 UserDirectoryCard (People)

```
rounded-2xl border border-border bg-card p-5
transition-colors hover:border-primary/30 hover:bg-primary/[0.02]
```

Avatar `h-12 w-12`; "Ask me about" callout: `rounded-xl border border-primary/10 bg-primary/[0.04] px-3 py-2`

Action row: `mt-auto flex gap-2 pt-4`; buttons `h-8 flex-1 text-xs`

### 13.5 Dashboard grid

`grid grid-cols-1 xl:grid-cols-12 gap-6` with mobile reorder via `order-N xl:order-none`

Motion on grid: `initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}`

---

## 14. Widgets

Shared widget header pattern:

```jsx
<div className="flex items-center justify-between p-5 pb-3">
  <h3 className="font-semibold text-sm flex items-center gap-2">
    <Icon className="w-4 h-4 text-primary" /> Widget Title
  </h3>
</div>
```

**Widget files:** `RecentNotificationsWidget`, `CompanyFeedWidget`, `SystemHealthWidget`, `TodaysCelebrationsWidget`, `WeeklyCalendarWidget`, `ProfileRecentApplicationsWidget`, `ActivityWidget`

**Empty widget:** `text-center py-8 text-sm text-muted-foreground`

**Embedded calendar widget:** wrapped in `bg-card rounded-2xl border border-border overflow-hidden`

---

## 15. Notifications & broadcasts

### 15.1 Notification visual tokens

**File:** `lib/notificationVisuals.js`

**Types:**

| Type | Color classes |
|------|---------------|
| `info` | `text-info bg-info/10 border-info/20` |
| `success` | `text-success bg-success/10 border-success/20` |
| `warning` | `text-warning bg-warning/10 border-warning/20` |
| `error` | `text-destructive bg-destructive/10 border-destructive/20` |
| `critical` | `text-critical bg-critical/10 border-critical/20` |

**Priorities:** low → muted; medium → info; high → warning; critical → critical

**Categories:** booking, hr, inventory, finance, security, system, task, approval, announcement, other — each with Lucide icon.

### 15.2 NotificationItem

```
rounded-xl p-3.5 border transition-all duration-200 cursor-pointer
```

Unread: type-specific `config.bg` + `config.border`; read: `bg-muted/30`

Icon box: `w-9 h-9 rounded-lg`; unread dot: `absolute top-3.5 right-3.5 w-2 h-2 rounded-full`

Action menu: `opacity-0 group-hover:opacity-100`

### 15.3 NotificationPanel

| Element | Spec |
|---------|------|
| Backdrop | `fixed inset-0 z-50 bg-black/20 backdrop-blur-sm` |
| Panel | `fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col` |
| Slide | `initial={{ x: '100%', opacity: 0 }}` → `{ x: 0, opacity: 1 }`; spring `damping: 30, stiffness: 300` |
| Unread pill | `text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full` |
| Filter tabs | `TabsList w-full bg-muted/50 h-9`; triggers `text-xs flex-1` |
| Footer CTA | `Button outline w-full text-sm h-9` → `/notifications` |
| Loading | `w-6 h-6 border-2 border-muted border-t-primary animate-spin` |

### 15.4 NotificationCenter

Date group header: `text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1`

List container: `bg-card rounded-2xl border border-border p-2 space-y-0.5`

Search: `pl-9 h-9 bg-muted/50 border-0`

### 15.5 GlobalBroadcastStrip

**File:** `GlobalBroadcastStrip.jsx` + ticker CSS in `index.css`

| Element | Spec |
|---------|------|
| Position | Fixed below TopBar at `top: 4rem`; embedded in AppLayout stack; `z-[25]` |
| Height | `h-7 sm:h-8` |
| Priority gradients | critical: red-900/800; high: amber-800/700; medium: slate-800/700; low: slate-700/600 |
| Live badge | `border-r border-white/10 bg-black/25 px-2.5 backdrop-blur-sm` |
| Live dot | urgent: `animate-ping bg-red-400` + `bg-red-500`; else `bg-emerald-400` |
| Badge labels | critical→Alert, high→Update, medium→News, low→Info; `text-[9px] font-bold uppercase tracking-[0.16em]` |
| Ticker text | `text-[10px] sm:text-[11px]`; title `font-semibold`; message `opacity-85` |
| Dismiss | `border-l border-white/10 px-2.5 hover:bg-white/10`; `X h-3 w-3` |
| Inner highlight | `shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]` |

**Ticker CSS:**

```css
@keyframes broadcast-ticker-rtl { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.broadcast-ticker-track { animation: broadcast-ticker-rtl linear infinite; will-change: transform; }
.broadcast-ticker-viewport--scroll { mask-image: linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent); }
.broadcast-ticker-viewport--scroll .broadcast-ticker-track:hover { animation-play-state: paused; }
```

Duration: `max(24, halfWidth/55)s`

### 15.6 Broadcast priority (admin)

Same as §8.4 broadcast priority table. Row backgrounds: `bg-info/5 border-info/20`, etc.

---

## 16. Application / system tiles & browser

### 16.1 ApplicationCard tile

| Property | Spec |
|----------|------|
| Shape | `aspect-square w-full rounded-xl` |
| Border | `border border-white/15 ring-1 ring-black/10` |
| Background | `system.color` or fallback `#6366f1` (`DEFAULT_BRAND_COLOR`) |
| CSS variable | `--app-glow: brandColor` for hover glow |
| Gradients | `from-white/15 via-transparent to-black/10` + hover `to-white/10` |
| Logo | `object-contain h-full w-full`; hover `scale-[1.06]` |
| Fallback letter | `text-2xl font-bold text-white/90` |
| Shadow | `shadow-[0_8px_20px_-10px_rgba(0,0,0,0.35)]` |
| Hover | `hover:border-white/25 hover:brightness-[1.03]` + glow shadow using `--app-glow` |
| Disabled | `opacity-60 cursor-not-allowed` |
| Launch overlay | `absolute inset-0 bg-black/40` + spinner `h-4 w-4 border-2 border-white border-t-transparent animate-spin` |

**Motion:**

```jsx
initial={{ opacity: 0, y: 16, scale: 0.94 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
transition={{ delay: index * 0.04, type: 'spring', stiffness: 320, damping: 26 }}
whileHover={{ y: -4, scale: 1.03 }}
whileTap={{ scale: 0.97, y: -2 }}
```

**Status indicators (corner badges):**

| Indicator | Position | Style |
|-----------|----------|-------|
| Notifications | bottom-left | `h-5 w-5 rounded-full border border-white/20 bg-black/55`; Bell `text-amber-300` |
| Active/online | bottom-right | same container; Activity `text-emerald-400` |
| Notification list badge | inline | `border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300` |

**List view icon fallback:** `w-10 h-10 rounded-lg object-cover` or brand color + first letter

### 16.2 CornerRibbon

Rotated `-45deg`; `shadow-[0_2px_8px_rgba(0,0,0,0.32)] ring-1 ring-inset ring-white/20`

Sizes: `default` (88px wrap, 8px text) and `sm` (56px wrap, 6px text)

Environment colors from `getEnvironmentBadge()` in `lib/applicationEnvironment.js`

### 16.3 ApplicationBrowser (embedded viewer)

**Route:** `/applications/:id/view` — full bleed

| Element | Spec |
|---------|------|
| Layout | `flex h-screen flex-col bg-background` |
| Toolbar | `border-b border-border bg-card/80 px-4 py-2.5 backdrop-blur-xl shrink-0` |
| Back | `Button ghost sm gap-1.5` |
| App icon | `h-7 w-7 rounded-md` |
| URL subtitle | `text-[11px] text-muted-foreground truncate` |
| Refresh | `Button ghost icon h-8 w-8` |
| Open in tab | `Button outline sm gap-1.5` |
| Embed blocked | `border-warning/30 bg-warning/10 px-4 py-3`; `AlertTriangle text-warning` |
| Iframe area | `relative min-h-0 flex-1 bg-muted/20`; iframe `h-full w-full border-0 bg-white` |

### 16.4 ApplicationsNav

Sub-nav tabs for Applications / Usage sections — follow standard Tabs pattern (§10.14).

### 16.5 Reorder list row

`flex items-center gap-4 rounded-xl border bg-card px-4 py-3`; dragging: `shadow-lg ring-2 ring-primary/30 bg-background z-10`

---

## 17. Empty, loading & error states

### 17.1 Loading spinners

| Context | Classes |
|---------|---------|
| **Primary (preferred)** | `w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin` |
| Auth bootstrap | `w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin` |
| NotificationPanel | `w-6 h-6 border-2 border-muted border-t-primary animate-spin` |
| App card launch | `h-4 w-4 border-2 border-white border-t-transparent` on `bg-black/40` |
| Inline / button | `Loader2 h-4 w-4 animate-spin` or inline SVG spinner |
| Legacy (avoid in new code) | `border-4 border-slate-200 border-t-slate-800` |

**Prefer semantic spinners** (`border-muted border-t-primary`) in all new pages.

### 17.2 Empty states

| Page | Pattern |
|------|---------|
| **People** | `rounded-2xl border border-dashed border-border px-6 py-16 text-center`; icon `h-10 w-10 text-muted-foreground/60` |
| **Applications** | `py-20 bg-card rounded-2xl border text-center`; icon `w-12 h-12 opacity-20` |
| **Notifications** | `py-16` or `py-20`; `Bell w-10/w-12 opacity-20/30` + subtitle |
| **Widgets** | `text-center py-8 text-sm text-muted-foreground` |
| **Tables** | Inline message inside bordered card |

### 17.3 In-app error states (token-based)

PersonProfile / ApplicationBrowser: centered `text-sm text-muted-foreground` + `Button outline` back action

### 17.4 Legacy error pages (do not replicate)

`PageNotFound.jsx` and `UserNotRegisteredError.jsx` use raw `slate-*` palette without dark mode. **New systems must use token-based patterns** (§26.4).

---

## 18. Toasts (Sonner)

**File:** `components/ui/sonner.jsx` — mounted as `<Toaster />` in `App.jsx`

| Setting | Value |
|---------|-------|
| `theme` | From `useTheme()` |
| `position` | `top-right` |
| `richColors` | `true` |
| `closeButton` | `true` |
| `className` | `toaster group` |

**Toast classes:**

```
group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground
group-[.toaster]:border-border group-[.toaster]:shadow-lg
```

**Description:** `group-[.toast]:text-muted-foreground`

**Action button:** `group-[.toast]:bg-primary group-[.toast]:text-primary-foreground`

**Cancel button:** `group-[.toast]:bg-muted group-[.toast]:text-muted-foreground`

**Usage:**

```js
import { toast } from 'sonner';
toast.success('Saved');
toast.error('Failed');
toast.info('Not available yet');
```

Push notifications map types via `notificationVisuals.js` → `toast.success|error|warning|info`.

---

## 19. Tables & pagination

### 19.1 Table base

Wrapper: `relative w-full overflow-auto`

Header row: `h-10 px-2 font-medium text-muted-foreground`

Body row: `hover:bg-muted/50`; cell: `p-2 align-middle`

### 19.2 Sticky header (admin / dashboard tables)

`TableHeader className="bg-muted/40 sticky top-0 z-10"`

First column: `pl-6`; actions column: `text-right pr-6`

Scrollable wrap: `[&>div]:max-h-64 [&>div]:overflow-auto`

### 19.3 ApplicationUsage table

Wrapper: `rounded-xl border border-border overflow-hidden mx-6`

Responsive hiding: `hidden md:table-cell`, `hidden lg:table-cell`

Numeric badges: `variant="secondary" tabular-nums`

### 19.4 Custom pagination (preferred in app)

```
flex flex-col gap-3 border-t border-border px-6 py-4
sm:flex-row sm:items-center sm:justify-between
```

"Showing {start}-{end} of {total}" + `Button outline sm` prev/next + "Page X of Y" `text-sm text-muted-foreground`

shadcn `Pagination` exists but is rarely used.

---

## 20. Motion & interaction

### 20.1 Standard entrances

| Pattern | Values | Usage |
|---------|--------|-------|
| Page header | `opacity: 0, y: -10` → `opacity: 1, y: 0` | Most admin pages |
| Content section | `opacity: 0, y: 16` → `opacity: 1, y: 0` | Cards, grids |
| Hero | `opacity: 0, y: 12` | ProfileDashboardHero |
| Stats stagger | `y: 20`, `delay: index * 0.05, duration: 0.3` | StatsCard |
| Dashboard grid | `y: 16`, `delay: 0.05` | Dashboard |

### 20.2 ApplicationCard

See §16.1 for full spring spec.

### 20.3 AnimatePresence

- NotificationPanel: backdrop fade + panel slide
- PwaInstallPrompt: slide up `y: 24`
- PwaSplashScreen: fade out `duration: 0.45 easeInOut`
- Collapsible rows: `height: 0 → auto`, `duration: 0.2`

### 20.4 Hover & transition durations

| Element | Duration / easing |
|---------|-------------------|
| AppLayout / TopBar | `transition-all duration-200` |
| Cards | `transition-all duration-300` |
| Nav / color | `transition-colors` |
| App card shadow | `transition-[box-shadow,filter] duration-300` |
| Cover/avatar load | `transition-opacity duration-300` |
| NotificationItem | `transition-all duration-200` |
| Sheet | open 500ms / close 300ms |
| Dialog | 200ms zoom/fade |

### 20.5 Hover conventions

| Element | Effect |
|---------|--------|
| Cards | `hover:shadow-lg hover:shadow-primary/5` |
| Stats icon box | `group-hover:scale-110` |
| Nav items | Color change only |
| Icon buttons | `hover:bg-muted transition-colors` |
| Links | `hover:text-primary/80 transition-colors` |
| People card | `hover:border-primary/30 hover:bg-primary/[0.02]` |
| App card admin actions | `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` |

---

## 21. Dark mode

- Class-based: `.dark` on `<html>`
- Storage key: `nexus-theme`
- Default: `light`; system preference: **disabled**
- Toggle: `ThemeToggle` (§8)
- **Rule:** All app pages use semantic tokens. Never `bg-white`, `text-black`, or `slate-*` in new code.
- Auth warning/success banners: always include `dark:` variants
- Glass panels: separate dark shadows (§7.0)
- Mobile auth card uses `bg-card` ( adapts to theme), not hardcoded white

---

## 22. Responsive behavior & breakpoints

| Breakpoint | px | Behavior |
|------------|-----|----------|
| default | < 640 | Single column, bottom nav, collapsible filters |
| `sm:` | 640 | Two-column grids, horizontal headers, keyboard hints |
| `md:` | 768 | Mobile/desktop split (`useIsMobile` threshold) |
| `lg:` | 1024 | Auth split layout, expanded filters |
| `xl:` | 1280 | Dashboard 12-column grid |

**Mobile patterns:**

- Filters in `Collapsible` (closed by default on mobile)
- Primary buttons: `w-full sm:w-auto`
- Page title: `text-xl sm:text-2xl`
- Panels: `hidden lg:flex` / `lg:hidden`
- Table columns: progressive disclosure with `hidden md:table-cell`

**Safe areas:** `env(safe-area-inset-bottom)` on all fixed bottom elements.

**PWA install prompt position:** `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]` (clears bottom nav)

---

## 23. Scrollbar & global CSS

**File:** `frontend/src/index.css`

### Global base

```css
* { @apply border-border outline-ring/50; }
body { @apply bg-background text-foreground font-sans; }
```

### Default scrollbar

- Width: `6px`
- Track: transparent
- Thumb: `hsl(var(--muted-foreground) / 0.3)`, radius `3px`
- Hover: opacity `0.5`

### Scrollbar-on-hover

Class: `scrollbar-on-hover`

- `scrollbar-gutter: stable`
- Thumb transparent until hover
- Use on scrollable panels that shouldn't show scrollbar constantly

---

## 24. PWA, meta & splash screen

**File:** `frontend/index.html`

| Meta | Value |
|------|-------|
| viewport | `width=device-width, initial-scale=1.0, viewport-fit=cover` |
| theme-color | `#2563eb` |
| manifest | Dynamic: `%VITE_API_BASE_URL%/api/pwa/manifest` |
| apple-mobile-web-app-capable | `yes` |
| mobile-web-app-capable | `yes` |
| apple-mobile-web-app-status-bar-style | `black-translucent` |
| apple-mobile-web-app-title | `EMZI Nexus Brain` |
| Icons | `/icons/pwa-icon-192.png`, apple-touch 180/192/512 |
| OG image | `/icons/banner.svg` |

### PwaSplashScreen

- `z-[9999] bg-[#022e96]`
- DotLottie: `/lottie/splash.lottie`
- Min display: 1200ms; max: 6000ms
- Blocks body scroll during display

### PwaInstallPrompt

Card: `rounded-2xl border-border/70 bg-card/95 backdrop-blur-xl shadow-xl p-4`

Position above bottom nav (see §22).

---

## 25. Hardcoded color exceptions

These are **intentional** — do not "fix" to tokens unless explicitly migrating.

| Location | Values | Notes |
|----------|--------|-------|
| App brand fallback | `#6366f1` | `DEFAULT_BRAND_COLOR` |
| PWA theme-color | `#2563eb` | `index.html` |
| PWA splash | `#022e96` | Splash screen bg |
| GlobalBroadcastStrip | Tailwind red/amber/slate/emerald gradients | Not semantic tokens |
| App tile badge icons | `text-amber-300`, `text-emerald-400` | On dark overlay |
| iframe background | `bg-white` | Embedded apps |
| PageNotFound / UserNotRegisteredError | Full `slate-*` palette | Legacy — migrate when touched |
| Celebrations widget | `amber-500/600` accents | Seasonal UI |

**All new pages and systems:** use semantic tokens only.

---

## 26. Standard page templates

### 26.1 Standard authenticated page

```jsx
import { motion } from 'framer-motion';
import { SomeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function NewPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SomeIcon className="w-6 h-6 text-primary" />
            Page Title
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Description.</p>
        </div>
        <Button className="gap-2 shrink-0">
          <SomeIcon className="w-4 h-4" /> Action
        </Button>
      </motion.div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Section</CardTitle>
          <CardDescription>Section description</CardDescription>
        </CardHeader>
        <CardContent>{/* content */}</CardContent>
      </Card>
    </div>
  );
}
```

### 26.2 Dashboard / stats page

Add stats row before content:

```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {stats.map((stat, i) => (
    <StatsCard key={stat.title} {...stat} index={i} />
  ))}
</div>
```

Filters in collapsible card (mobile collapsed by default):

```jsx
<Collapsible open={isMobile ? filtersOpen : true}>
  <Card>
    <CollapsibleTrigger asChild disabled={!isMobile}>
      <CardHeader className={cn('pb-3', isMobile && 'cursor-pointer select-none')}>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filters
          {isMobile && <ChevronDown className={cn('w-4 h-4 ml-auto transition-transform', filtersOpen && 'rotate-180')} />}
        </CardTitle>
      </CardHeader>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <CardContent>{/* filter grid */}</CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>
```

### 26.3 Settings / tabbed page

```jsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="h-10">
    <TabsTrigger value="general" className="gap-2">
      <Icon className="w-4 h-4" /> General
    </TabsTrigger>
  </TabsList>
  <TabsContent value="general" className="space-y-6">
    <Card className="rounded-2xl">{/* switch rows */}</Card>
  </TabsContent>
</Tabs>
```

### 26.4 Not found / error page (token-based)

```jsx
<div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
  <p className="text-7xl font-light text-muted-foreground/40">404</p>
  <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
  <p className="text-sm text-muted-foreground max-w-sm">Description.</p>
  <Button asChild><Link to="/">Back to dashboard</Link></Button>
</div>
```

---

## 27. Icon sizing reference

| Context | Size |
|---------|------|
| Inline with button text | `w-4 h-4` |
| Card / section title | `w-4 h-4 text-primary` |
| Page title (desktop) | `w-6 h-6 text-primary` |
| Page title (mobile) | `w-5 h-5 text-primary` |
| TopBar / bottom nav | `h-5 w-5` |
| Widget header | `w-4 h-4 text-primary` |
| Empty state | `h-10 w-10` or `w-12 h-12 opacity-20` |
| Settings icon box | `w-4 h-4` inside `w-9 h-9` box |
| Notification item icon box | `w-9 h-9` container |
| App tile status icons | `h-2.5 w-2.5` |
| Theme toggle | `h-5 w-5` |
| Toolbar (embedded browser) | `w-4 h-4` |
| Alert banner inline | `w-4 h-4` |
| Checklist icons | `w-3.5 h-3.5` |

**Rule:** All icons from **Lucide React** only. `[&_svg]:size-4` applied on buttons.

---

## 28. Pre-ship checklist

### Tokens & theme
- [ ] Uses semantic color tokens (no raw hex/slate except §25)
- [ ] Dark mode tested — all surfaces adapt
- [ ] No hardcoded `bg-white` / `text-black` in app pages

### Layout
- [ ] Page uses `space-y-6` inside AppLayout container
- [ ] Bottom nav clearance respected on mobile
- [ ] Full-bleed routes registered in AppLayout if needed
- [ ] Broadcast strip offset considered if fixed header content

### Typography & headers
- [ ] Page title: icon + title + description (§4.3)
- [ ] Correct type scale for mobile vs desktop

### Components
- [ ] shadcn/ui components from `@/components/ui/*`
- [ ] Cards: `rounded-2xl border border-border bg-card`
- [ ] Buttons: correct variant + size
- [ ] Forms: Label above Input; focus rings present
- [ ] Avatars: square `rounded-lg` in chrome, correct fallback colors
- [ ] Icons: Lucide only, sizes per §27

### Navigation
- [ ] New routes added to `navItems.js` if needed
- [ ] Mobile dock stays ≤ 6 items; overflow in MobileMoreMenu
- [ ] Active state `match()` handles nested paths

### States
- [ ] Loading: semantic spinner (§17.1)
- [ ] Empty: dashed border or centered icon pattern (§17.2)
- [ ] Errors: token-based banners or inline messages
- [ ] Destructive actions use AlertDialog

### Motion & feedback
- [ ] Header entrance animation
- [ ] Toasts via Sonner
- [ ] Hover transitions ≤ 300ms

### Application tiles (if applicable)
- [ ] Square tile spec (§16.1)
- [ ] Brand color + fallback `#6366f1`
- [ ] CornerRibbon for environment
- [ ] Status badges correct

### Accessibility
- [ ] `aria-label` on icon-only buttons
- [ ] Form labels linked with `htmlFor`
- [ ] Focus visible via `ring-ring`

---

## 29. Reference files

| Area | File |
|------|------|
| CSS tokens & ticker | `frontend/src/index.css` |
| Tailwind config | `frontend/tailwind.config.js` |
| shadcn config | `frontend/components.json` |
| HTML / PWA meta | `frontend/index.html` |
| App root | `frontend/src/App.jsx` |
| App shell | `frontend/src/components/layout/AppLayout.jsx` |
| Top bar | `frontend/src/components/layout/TopBar.jsx` |
| Bottom nav | `frontend/src/components/layout/BottomNav.jsx` |
| Nav items | `frontend/src/components/layout/navItems.js` |
| Mobile menu | `frontend/src/components/layout/MobileMoreMenu.jsx` |
| Global search | `frontend/src/components/layout/GlobalSearch.jsx` |
| Glass styles | `frontend/src/components/layout/glassStyles.js` |
| Theme | `frontend/src/components/theme/ThemeProvider.jsx`, `ThemeToggle.jsx` |
| Toaster | `frontend/src/components/ui/sonner.jsx` |
| Auth pages | `frontend/src/pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx` |
| Settings | `frontend/src/pages/Settings.jsx` |
| Dashboard | `frontend/src/pages/Dashboard.jsx` |
| Profile hero | `frontend/src/components/dashboard/ProfileDashboardHero.jsx` |
| Profile about | `frontend/src/components/dashboard/ProfileAboutCard.jsx` |
| Stats card | `frontend/src/components/dashboard/StatsCard.jsx` |
| People card | `frontend/src/components/people/UserDirectoryCard.jsx` |
| Application card | `frontend/src/components/applications/ApplicationCard.jsx` |
| Corner ribbon | `frontend/src/components/applications/CornerRibbon.jsx` |
| App browser | `frontend/src/pages/ApplicationBrowser.jsx` |
| Broadcast strip | `frontend/src/components/broadcasts/GlobalBroadcastStrip.jsx` |
| Notification panel | `frontend/src/components/notifications/NotificationPanel.jsx` |
| Notification visuals | `frontend/src/lib/notificationVisuals.js` |
| Media constants | `frontend/src/lib/media.js` |
| Brand color | `frontend/src/lib/imageColor.js` |
| Mobile hook | `frontend/src/hooks/use-mobile.jsx` |

---

*Last updated from Nexus frontend codebase. When patterns change in code, update this document to match.*
