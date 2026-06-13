# Nexus Design Template

Use this document as the single source of truth when building new pages, features, or integrated systems inside **EMZI Nexus Brain**. Every new system should match these patterns so the product feels cohesive.

---

## 1. Design principles

| Principle | Rule |
|-----------|------|
| **Consistency** | Use shared tokens, shadcn/ui components, and Lucide icons — never one-off colors or custom UI libraries. |
| **Clarity** | One primary action per section. Labels above inputs. Page titles always include a short description. |
| **Responsive first** | Mobile gets simplified layouts (cards, collapsible filters, bottom nav). Desktop gets full toolbars and multi-column grids. |
| **Accessible** | Semantic HTML, `aria-label` on icon-only buttons, focus rings via `ring-ring`, sufficient color contrast in both themes. |
| **Subtle motion** | Entrance animations via Framer Motion; hover transitions ≤ 300ms. Never block interaction with animation. |

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Framework | React + React Router |
| Styling | Tailwind CSS + CSS variables |
| Component library | shadcn/ui (New York style) |
| Icons | Lucide React |
| Animation | Framer Motion |
| Toasts | Sonner |
| Data fetching | TanStack Query |

**Import aliases** (from `components.json`):

- `@/components/ui/*` — shadcn primitives
- `@/components/*` — app components
- `@/lib/utils` — `cn()` helper
- `@/hooks/*` — shared hooks

---

## 3. Color system

All colors are HSL CSS variables defined in `frontend/src/index.css` and mapped in `frontend/tailwind.config.js`. **Never hardcode hex values** except for application brand colors (see §12).

### 3.1 Core tokens

| Token | Light | Usage |
|-------|-------|-------|
| `--background` | `220 20% 97%` | Page background |
| `--foreground` | `222 47% 11%` | Primary text |
| `--card` | `0 0% 100%` | Card / panel surfaces |
| `--primary` | `206 92% 36%` | Brand blue — buttons, links, active nav |
| `--primary-foreground` | `0 0% 100%` | Text on primary |
| `--muted` | `220 14% 96%` | Subtle backgrounds |
| `--muted-foreground` | `220 9% 46%` | Secondary text, descriptions |
| `--border` | `220 13% 91%` | Borders, dividers |
| `--ring` | `206 92% 36%` | Focus rings |

### 3.2 Semantic tokens

| Token | HSL | Usage |
|-------|-----|-------|
| `--success` | `160 84% 39%` | Online, healthy, confirmed |
| `--warning` | `38 92% 50%` | Degraded, maintenance, caution |
| `--destructive` | `0 84% 60%` | Errors, offline, delete |
| `--info` | `210 71% 35%` | Informational badges |
| `--critical` | `330 80% 55%` | Critical alerts |

**Tailwind usage:** `bg-primary`, `text-muted-foreground`, `border-destructive/30`, `bg-success/10`, etc.

### 3.3 Brand panel (auth pages)

Auth split-layout left panel uses a fixed deep blue palette (not theme tokens):

- Base: `bg-[hsl(206,92%,15%)]`
- Gradient: `from-[hsl(206,92%,25%)] via-[hsl(206,92%,20%)] to-[hsl(206,92%,10%)]`
- Decorative blurs: `bg-primary/20`, `bg-primary/10`
- Text on panel: `text-white`, `text-white/60`, `text-white/50`
- Feature chips: `bg-white/10 ring-1 ring-white/10`

### 3.4 Border radius

- Global `--radius`: `0.75rem` (12px)
- Cards (standard): `rounded-xl` or `rounded-2xl`
- Auth mobile card: `rounded-3xl`
- Buttons/inputs: `rounded-md`
- Avatars (square): `rounded-lg`
- Application tiles: `rounded-xl`

---

## 4. Typography

| Element | Classes |
|---------|---------|
| Font family | `Inter` (sans), `JetBrains Mono` (mono) |
| Page title (desktop) | `text-2xl font-bold tracking-tight` |
| Page title (mobile) | `text-xl font-bold tracking-tight` |
| Page description | `text-sm text-muted-foreground mt-1` |
| Section title (card) | `text-base font-semibold` or `CardTitle` |
| Section description | `text-sm text-muted-foreground` |
| Form label | `text-sm font-medium text-foreground` |
| Helper / caption | `text-xs text-muted-foreground` |
| Stats label | `text-xs font-medium text-muted-foreground uppercase tracking-wider` |
| Stats value | `text-3xl font-bold tracking-tight` |
| Bottom nav label | `text-[10px] font-medium leading-none` |

**Page title pattern** — icon + title + description:

```jsx
<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
  <SomeIcon className="w-6 h-6 text-primary" />
  Page Title
</h1>
<p className="text-sm text-muted-foreground mt-1">
  One-line description of what this page does.
</p>
```

Optional entrance animation:

```jsx
<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
  {/* header content */}
</motion.div>
```

---

## 5. Layout & spacing

### 5.1 App shell

```
┌─────────────────────────────────────────────┐
│  TopBar (h-16, fixed, backdrop-blur)        │
│  [Optional] GlobalBroadcastStrip            │
├─────────────────────────────────────────────┤
│  main (pt-16, pb bottom-nav on mobile)      │
│  ┌─────────────────────────────────────┐    │
│  │  max-w-[1600px] mx-auto             │    │
│  │  p-4 sm:p-6                         │    │
│  │  { page content }                   │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  BottomNav (fixed, glass dock)              │
└─────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Max content width | `max-w-[1600px] mx-auto` |
| Page padding | `p-4 sm:p-6` |
| Section vertical gap | `space-y-6` |
| Grid gap | `gap-6` |
| Top bar height | `h-16` (4rem) |
| Bottom nav offset | `pb-[calc(4.75rem+env(safe-area-inset-bottom))]` |

### 5.2 Layout variants

| Variant | When | Key classes |
|---------|------|-------------|
| **Standard** | Most pages | Container + padding + bottom nav |
| **Full bleed** | Embedded app viewer (`/applications/:id/view`) | No top bar, no padding, no bottom nav |
| **Analytics** | Fixed viewport dashboard | `h-[100dvh] overflow-hidden`, flex column |

### 5.3 Grid patterns

| Pattern | Classes |
|---------|---------|
| Dashboard 3-column | `grid grid-cols-1 xl:grid-cols-12 gap-6` with `xl:col-span-3/6/3` |
| Stats row | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` |
| Application grid | Responsive auto-fill grid of square cards |
| Filter bar | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3` |

### 5.4 Page header + actions

```jsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    {/* title + description */}
  </div>
  <Button variant="outline" className="gap-2">
    <Icon className="w-4 h-4" /> Action
  </Button>
</div>
```

---

## 6. Navigation

### 6.1 Top bar

- Background: `bg-card/80 backdrop-blur-xl border-b border-border`
- Height: `h-16`, horizontal padding: `px-6`
- Left: global search (+ mobile hamburger menu)
- Right (desktop): theme toggle, notification bell, user avatar dropdown
- Right (mobile): theme toggle only

### 6.2 Bottom navigation (glass dock)

Uses `glassDockStyles` from `frontend/src/components/layout/glassStyles.js`:

```
backdrop-blur-2xl
bg-card/30 border-border/50 shadow
rounded-2xl border
```

- Fixed bottom, centered, safe-area aware
- Active item: `text-primary` + top indicator bar (`h-0.5 w-8 bg-primary`)
- Inactive: `text-muted-foreground hover:text-foreground`
- Badge counts: `bg-destructive text-destructive-foreground text-[9px]`

### 6.3 Icon sizing in nav

- Nav icons: `h-5 w-5`
- Page title icons: `w-6 h-6` (desktop), `w-5 h-5` (mobile)

---

## 7. Auth page template

Split layout on desktop (`lg:` breakpoint). Full-screen branded experience on mobile.

### 7.1 Structure

```
Desktop (lg+):
┌──────────────────┬──────────────────┐
│  Brand panel     │  Form panel      │
│  (50% width)     │  (50% width)     │
│  Logo top        │  Logo + form     │
│  Hero center     │                  │
│  Feature chips   │                  │
└──────────────────┴──────────────────┘

Mobile:
┌──────────────────┐
│  Theme toggle    │
│  Banner logo     │
│  ┌────────────┐  │
│  │ White card │  │
│  │  (form)    │  │
│  └────────────┘  │
│  Footer text     │
└──────────────────┘
```

### 7.2 Form panel rules

| Element | Mobile | Desktop |
|---------|--------|---------|
| Container | `bg-card rounded-3xl p-8 shadow-2xl` | No card wrapper |
| Title | `text-3xl font-bold text-center` | `text-2xl font-bold` |
| Subtitle | `text-sm text-muted-foreground text-center` | `text-sm text-muted-foreground` |
| Input height | `h-12` | `h-11` |
| Submit button | `w-full h-12 font-semibold text-base shadow-md shadow-primary/20` | `w-full h-11 font-semibold text-sm` |

### 7.3 Input focus state (auth)

```
focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors
placeholder:text-muted-foreground/50
```

---

## 8. Components

Always import from `@/components/ui/*`. Do not recreate primitives.

### 8.1 Cards

**Standard card:**

```jsx
<Card className="rounded-2xl">
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" /> Section Title
    </CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>{/* content */}</CardContent>
</Card>
```

**Stats card:**

```
bg-card rounded-2xl border border-border p-5
hover:shadow-lg hover:shadow-primary/5 transition-all duration-300
```

**Widget card (embedded):**

```
bg-card rounded-2xl border border-border overflow-hidden
```

### 8.2 Buttons

| Variant | Use case |
|---------|----------|
| `default` | Primary actions (Save, Submit, Create) |
| `outline` | Secondary actions (Export, Cancel-adjacent) |
| `ghost` | Icon buttons, toolbar actions |
| `destructive` | Delete, irreversible actions |
| `secondary` | Less prominent actions |
| `link` | Inline text actions |

| Size | Height | Use case |
|------|--------|----------|
| `default` | `h-9` | Standard buttons |
| `sm` | `h-8` | Compact toolbars |
| `lg` | `h-10` | Prominent CTAs |
| `icon` | `h-9 w-9` | Icon-only |

Primary CTA enhancement: `shadow-md shadow-primary/20 hover:shadow-primary/30`

### 8.3 Form fields

```jsx
<div className="space-y-1.5">
  <Label htmlFor="field" className="text-sm font-medium">Label</Label>
  <Input id="field" placeholder="..." />
</div>
```

Filter labels: `text-xs text-muted-foreground mb-1 block`

Form section spacing: `space-y-5` (auth) or `space-y-6` (settings)

### 8.4 Badges & status

**Application / system status:**

| Status | Icon | Colors |
|--------|------|--------|
| `online` | Wifi | `text-success bg-success/10 border-success/30` |
| `offline` | WifiOff | `text-destructive bg-destructive/10 border-destructive/30` |
| `maintenance` | Wrench | `text-warning bg-warning/10 border-warning/30` |
| `degraded` | AlertTriangle | `text-warning bg-warning/10 border-warning/30` |

**Broadcast priority:**

| Priority | Background |
|----------|------------|
| `low` | `bg-muted text-muted-foreground` |
| `medium` | `bg-info/10 text-info` |
| `high` | `bg-warning/10 text-warning` |
| `critical` | `bg-critical/10 text-critical` |

Badge sizing in compact contexts: `text-[10px]` or `text-xs`

### 8.5 Alerts & banners

**Error:**

```
rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3
text-sm text-destructive
```

**Warning (pending approval):**

```
rounded-xl border border-amber-200 bg-amber-50 px-4 py-3
dark:border-amber-800/40 dark:bg-amber-900/20
text-sm text-amber-700 dark:text-amber-400
```

### 8.6 Tables

- Wrap in `Card` with `CardHeader` + `CardContent`
- Scrollable body: `[&>div]:max-h-64 [&>div]:overflow-auto`
- Sticky header: `sticky top-0 z-10 bg-card`

### 8.7 Dialogs

Use `Dialog` for create/edit forms, `AlertDialog` for destructive confirmations.

### 8.8 Tabs

```jsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="h-10">
    <TabsTrigger value="tab1" className="gap-2">
      <Icon className="w-4 h-4" /> Tab Label
    </TabsTrigger>
  </TabsList>
  <TabsContent value="tab1" className="space-y-6">
    {/* tab content */}
  </TabsContent>
</Tabs>
```

### 8.9 Toasts

Use Sonner via `toast.success()`, `toast.error()`, `toast.info()`.

---

## 9. Motion & interaction

### 9.1 Page / section entrance

```jsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.05 }}
>
```

Header entrance: `initial={{ opacity: 0, y: -10 }}`

### 9.2 Application card

```jsx
initial={{ opacity: 0, y: 16, scale: 0.94 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
transition={{ delay: index * 0.04, type: 'spring', stiffness: 320, damping: 26 }}
whileHover={{ y: -4, scale: 1.03 }}
whileTap={{ scale: 0.97, y: -2 }}
```

### 9.3 Hover conventions

| Element | Effect |
|---------|--------|
| Cards | `hover:shadow-lg`, optional `group-hover:scale-110` on icon |
| Nav items | Color change only |
| Icon buttons | `hover:bg-muted transition-colors` |
| Links | `hover:text-primary/80 transition-colors` |

### 9.4 Loading states

- Button spinner: inline SVG with `animate-spin`
- Full overlay: `bg-black/40` with centered spinner
- Skeleton: use `@/components/ui/skeleton`

---

## 10. Dark mode

- Toggle via `ThemeToggle` component
- Class-based: `.dark` on root element
- All surfaces must use semantic tokens (`bg-card`, `text-foreground`) — never fixed `bg-white` or `text-black` in app pages
- Auth warning banners include `dark:` variants
- Glass panels have separate dark shadows: `dark:bg-card/35 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]`

---

## 11. Responsive behavior

| Breakpoint | Behavior |
|------------|----------|
| Default (mobile) | Single column, bottom nav, collapsible filters |
| `sm:` (640px) | Two-column grids, horizontal page headers |
| `lg:` (1024px) | Auth split layout, expanded filter grids |
| `xl:` (1280px) | Dashboard 12-column layout |

**Mobile-specific patterns:**

- Filters inside `Collapsible` (closed by default on mobile)
- Full-width primary buttons: `w-full sm:w-auto`
- Page title: `text-xl sm:text-2xl`
- Hide/show panels with `hidden lg:flex` / `lg:hidden`

**Safe areas:** Always account for `env(safe-area-inset-bottom)` on fixed bottom elements.

---

## 12. Application / system tiles

When registering a new integrated system in Nexus:

| Property | Spec |
|----------|------|
| Tile shape | Square (`aspect-square`) |
| Corner radius | `rounded-xl` |
| Border | `border border-white/15` |
| Background | System brand color (`system.color`), fallback `#6366f1` |
| Logo | `object-contain`, full tile, hover scale `1.06` |
| Fallback letter | `text-2xl font-bold text-white/90` centered |
| Shadow | `shadow-[0_8px_20px_-10px_rgba(0,0,0,0.35)]` |
| Hover glow | Uses `--app-glow` CSS variable from brand color |

**Icon fallback (list views):** `w-10 h-10 rounded-lg` with brand color background.

**Environment ribbon:** Use `CornerRibbon` component for staging/production badges.

---

## 13. Standard page template

Copy this structure for every new authenticated page:

```jsx
import { motion } from 'framer-motion';
import { SomeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function NewPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
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
          <p className="text-sm text-muted-foreground mt-1">
            Brief description of this page.
          </p>
        </div>
        {/* Optional primary action */}
        <Button className="gap-2">
          <SomeIcon className="w-4 h-4" />
          Primary Action
        </Button>
      </motion.div>

      {/* Content sections */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Section Title</CardTitle>
          <CardDescription>Section description</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Section content */}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 14. Scrollbar

Custom thin scrollbar (global):

- Width: `6px`
- Thumb: `hsl(var(--muted-foreground) / 0.3)`, rounded `3px`
- Hover-reveal variant: class `scrollbar-on-hover`

---

## 15. Checklist for new systems

Before shipping any new page or integrated system, verify:

- [ ] Uses semantic color tokens (no raw hex except app brand color)
- [ ] Page wrapped in `space-y-6` with `max-w-[1600px]` (handled by AppLayout)
- [ ] Page title follows icon + title + description pattern
- [ ] All buttons use `@/components/ui/button` variants
- [ ] All form fields use `Label` + `Input`/`Select`/`Textarea` from ui/
- [ ] Cards use `rounded-2xl border border-border bg-card`
- [ ] Icons from Lucide only, sized consistently (`w-4 h-4` inline, `w-5/w-6` in headers)
- [ ] Loading, empty, and error states styled with semantic colors
- [ ] Mobile layout tested (bottom nav clearance, collapsible sections)
- [ ] Dark mode tested — no hardcoded light-only colors
- [ ] Animations use Framer Motion with subtle delays, not blocking UX
- [ ] Toasts via Sonner for user feedback
- [ ] Destructive actions use `AlertDialog`, not `window.confirm`
- [ ] Application tiles follow §12 if adding to Applications grid

---

## 16. Reference files

| Area | File |
|------|------|
| CSS tokens | `frontend/src/index.css` |
| Tailwind config | `frontend/tailwind.config.js` |
| App shell | `frontend/src/components/layout/AppLayout.jsx` |
| Top bar | `frontend/src/components/layout/TopBar.jsx` |
| Bottom nav | `frontend/src/components/layout/BottomNav.jsx` |
| Glass styles | `frontend/src/components/layout/glassStyles.js` |
| Auth template | `frontend/src/pages/Login.jsx` |
| Settings page | `frontend/src/pages/Settings.jsx` |
| Dashboard grid | `frontend/src/pages/Dashboard.jsx` |
| Stats card | `frontend/src/components/dashboard/StatsCard.jsx` |
| Application card | `frontend/src/components/applications/ApplicationCard.jsx` |
| shadcn config | `frontend/components.json` |

---

*Last updated from Nexus frontend codebase. When patterns change in code, update this document to match.*
