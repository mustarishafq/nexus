# Initial Setup — EMZI Satellite Application (Laravel + React)

Portable setup guide for **any EMZI Nexus satellite application**: self-hosted **Laravel API** in `backend/` and **Vite + React** in `frontend/`. **Linkly** in this repository is the reference implementation; replace `{app}`, `{db}`, and domain-specific names with your project.

> **Scope:** Universal requirements (architecture, design template, SSO, webhooks, MCP, deployment) apply to **every** satellite app. Sections marked **Linkly example** are migration notes for this repo only — skip them when bootstrapping a greenfield app.

For day-to-day commands after setup, see the root [README.md](../README.md).

## Table of contents

1. [Migration phases (master checklist)](#migration-phases-master-checklist)
2. [What changed](#what-changed)
3. [Architecture](#architecture)
4. [Project structure](#project-structure)
5. [Remove Base44 dependencies](#remove-base44-dependencies)
6. [Legacy folder cleanup](#legacy-folder-cleanup)
7. [Rework the UI](#rework-the-ui--follow-design_templatemd)
8. [Optional — Nexus SSO](#optional--nexus-sso-nexus-brain)
9. [Optional — Event webhooks](#optional--event-webhooks-nexus-brain)
10. [Optional — MCP API catalog](#optional--mcp-api-catalog-nexus-brain-ai)
11. [Database design](#database-design--no-uuid-primary-keys)
12. [Prerequisites](#prerequisites)
13. [Initial setup (fresh install)](#initial-setup-fresh-install)
14. [Post-install admin configuration](#post-install-admin-configuration)
15. [Linkly features overview](#linkly-features-overview)
16. [Verify the migration](#verify-the-migration)
17. [Migrating existing data](#migrating-existing-base44--express-data-optional)
18. [Production deployment](#production-deployment--react-spa-on-apache)
19. [Related documentation](#related-documentation)

---

## Migration phases (master checklist)

Use this order when standing up or migrating any EMZI satellite app. Check off each phase before production.

```
Phase 1 — Backend & database
[ ] Laravel app in backend/; integer PK migrations ($table->id())
[ ] npm run migrate && npm run seed (or project equivalents)
[ ] Frontend API client wired to Laravel /api/* routes

Phase 2 — Legacy cleanup (if migrating from Base44 / Express)
[ ] Remove platform SDK (@base44/*) and duplicate root src/, server/
[ ] Canonical code lives in frontend/ + backend/

Phase 3 — UI & navigation (required — all systems)
[ ] Rework pages per DESIGN_TEMPLATE.md (tokens, shadcn/ui, layout)
[ ] Implement glass dock mobile nav per MOBILE_BOTTOM_NAV_DESIGN.md
[ ] Back navigation: useGoBack / BackButton / navigationFallbacks (DESIGN_TEMPLATE §7.5)
[ ] Pass DESIGN_TEMPLATE.md §28 pre-ship checklist

Phase 4 — Auth & admin (required — all systems)
[ ] Register / login / JWT flow works
[ ] User approval workflow if applicable (admin approves in User Management)
[ ] Configure SMTP or DEV_SHOW_RESET_TOKEN for password reset locally
[ ] Post-install settings: General, Security, domain-specific tabs

Phase 5 — Domain features (per app)
[ ] Implement core product entities and public routes
[ ] In-app notifications and audit logs if required
[ ] Linkly example: short links, campaigns, QR, analytics — see § Linkly features

Phase 6 — Nexus integrations (optional — same contract for every app)
[ ] Nexus SSO — nexus-sso-setup.md
[ ] Event webhooks — event-webhook-setup.md
[ ] MCP catalog — emzi-nexus-mcp-catalog-spec.md (implement /api/mcp/v1/*)

Phase 7 — Production (required — all systems)
[ ] Build frontend with correct VITE_API_BASE_URL
[ ] Deploy dist/ + .htaccess; Laravel on API host — REACT_SPA_APACHE_HTACCESS.md
```

---

## What changed

| Area | Legacy / platform (typical) | EMZI satellite stack (standard) |
|------|---------------------------|----------------------------------|
| Backend | Hosted API / SDK (e.g. Base44) | **Laravel** (`backend/`) |
| Frontend API client | Platform SDK | Plain **`fetch` + JWT** (e.g. `openClient.js`) |
| Database | Platform-managed, often **UUID** PKs | **MySQL 8** you control |
| Primary keys | UUID strings on entities & users | **`BIGINT UNSIGNED AUTO_INCREMENT`** (`$table->id()`) |
| Auth | Platform session / tokens | **JWT** + optional [Nexus SSO](./nexus-sso-setup.md) |
| Dev server | Single hosted dev URL | Vite `:5180` + Laravel `:8010` (or Herd) |
| Entity schemas | Export JSON schemas | JSON as **documentation**; data in MySQL tables |

### Linkly example (Base44 migration)

| Area | Base44 (before) | Linkly (now) |
|------|-----------------|--------------|
| Backend | Base44 hosted API | Laravel 13 in `backend/` |
| Client | `@base44/sdk` | `frontend/src/api/openClient.js` |
| Tables | UUID PKs | Integer PKs + `entity_*` JSON payload pattern |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  frontend/  (Vite + React)                                  │
│  • UI, routing, TanStack Query                              │
│  • openClient.js → /api/* (proxied in dev)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP + Bearer JWT
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  backend/  (Laravel)                                        │
│  • routes/api.php — auth, entities, admin, SSO, settings    │
│  • EntityService — JSON payload in entity_* tables           │
│  • Migrations + seeders                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    MySQL 8 ({db_name})
```

Entity records use a **JSON `payload` column** plus integer metadata columns — the same pattern Base44 used conceptually, but IDs are assigned by MySQL, not UUID generators.

---

## Project structure

Standard monorepo layout for EMZI satellite apps:

```
{app}/
├── frontend/              # React SPA (active app)
│   ├── src/
│   │   └── api/openClient.js   # API client (replaces platform SDK)
│   ├── entities/          # Entity JSON schemas (documentation)
│   └── .env.example
├── backend/               # Laravel API
│   ├── app/
│   ├── database/migrations/
│   ├── routes/api.php
│   └── .env.example
├── docs/                  # Shared EMZI specs + app setup
└── package.json           # Root scripts (dev, migrate, seed)
```

**Linkly example:** repo root is `linkly/`. See [Legacy folder cleanup](#legacy-folder-cleanup) if migrating from an older single-folder Base44 export.

---

## Remove Base44 dependencies

**Linkly example only** — when porting a Base44-exported project, remove platform-specific packages and imports.

### 1. Uninstall Base44 packages

From the frontend `package.json`, remove entries such as:

- `@base44/sdk`
- Any other `@base44/*` packages

Then reinstall:

```bash
npm install --prefix frontend
```

### 2. Replace SDK imports

**Before (Base44):**

```js
import { base44 } from "@base44/sdk";
const links = await base44.entities.ShortLink.list();
```

**After (Linkly):**

```js
import db from "@/api/openClient";
const links = await db.entities.ShortLink.list();
```

`openClient.js` exposes the same ergonomic surface: `db.entities.*`, `db.auth.*`, `db.settings`, `db.admin`, etc., all backed by your Laravel API.

### 3. Remove Base44 environment variables

Delete variables such as `VITE_BASE44_APP_ID`, `BASE44_API_KEY`, or platform URLs from `.env` files. Use:

| App | File | Purpose |
|-----|------|---------|
| API | `backend/.env` | DB, JWT, mail, admin seed, CORS |
| SPA | `frontend/.env` | `VITE_API_BASE_URL`, `VITE_DEV_API_TARGET` |

### 4. Drop the Express shim (if present)

Early self-hosted prototypes used `server/index.js` + `mysql2`. That stack is **replaced by Laravel**. Delete `server/` and root-level API scripts (`dev:api` pointing at Node) once `backend/` is in place.

---

## Legacy folder cleanup

**Linkly example only** — after `frontend/` and `backend/` are working, remove duplicate legacy paths.

### Delete when safe

| Path | Reason |
|------|--------|
| `server/` | Replaced by `backend/` (Laravel) |
| Root `src/` | Duplicate of `frontend/src/` |
| Root `entities/` | Schemas live in `frontend/entities/` |
| Root `package.json`, `vite.config.js`, `index.html` | If present — superseded by `frontend/` and root monorepo `package.json` |

### Keep

| Path | Reason |
|------|--------|
| `frontend/` | Active React SPA |
| `backend/` | Active Laravel API |
| Root `package.json` | `npm run dev`, `migrate`, `seed` |
| `docs/` | Setup and integration guides |

### Verify cleanup

```bash
# Should list only frontend (and maybe backend if grepping broadly)
ls src 2>/dev/null && echo "WARN: root src/ still exists" || echo "OK: no root src/"
test -d server && echo "WARN: server/ still exists" || echo "OK: no server/"
grep -r "@base44" frontend/package.json package.json 2>/dev/null || echo "OK: no Base44 packages"
```

Run `npm run dev` from the repo root and confirm the app loads from **`frontend/`** only.

---

## Rework the UI — follow DESIGN_TEMPLATE.md

A platform export (e.g. Base44) ships with its own default layout. After wiring the Laravel backend, **rework every page and shared component** so the app matches the EMZI system template.

**[DESIGN_TEMPLATE.md](./DESIGN_TEMPLATE.md)** is the single source of truth for how **all** satellite apps should look and behave. Treat it as mandatory, not optional styling guidance.

### What to rework

| Area | Base44 export (typical) | Target (per DESIGN_TEMPLATE.md) |
|------|-------------------------|----------------------------------|
| Layout | Generic sidebar / ad-hoc spacing | `AppLayout`, bottom nav on mobile, `PageHeader` with title + description |
| Components | Mixed or platform defaults | **shadcn/ui** (New York) from `frontend/src/components/ui/` only |
| Colors | Hardcoded `slate-*`, `bg-white` | CSS token variables in `frontend/src/index.css` (`bg-card`, `text-foreground`, etc.) |
| Icons | Mixed icon sets | **Lucide React** only |
| Auth screens | Platform login chrome | Auth page template (§9) — theme toggle, Nexus SSO link where enabled |
| Tables & forms | Inconsistent patterns | Standard page templates (§26), tables & pagination (§19), forms (§12) |
| Feedback | Alerts or none | **Sonner** toasts, empty/loading/error states (§17) |
| Theme | Light-only or partial dark mode | `ThemeProvider` + next-themes, full dark mode (§8, §21) |

### Recommended order

1. **Global shell** — Ensure `App.jsx` wraps the app with `ThemeProvider`, `QueryClientProvider`, `AuthProvider`, and `Toaster` as shown in DESIGN_TEMPLATE §2.
2. **Tokens & theme** — Align `index.css` and `tailwind.config.js` with §3–§4 before touching individual pages.
3. **Layout & navigation** — Refactor `AppLayout`, sidebar, and mobile bottom nav to §6–§7. Detail and error pages must use `useGoBack` / `BackButton` (history `-1`, then route fallback) per §7.5.
4. **Mobile glass dock** — Follow **[MOBILE_BOTTOM_NAV_DESIGN.md](./MOBILE_BOTTOM_NAV_DESIGN.md)** for the bottom bar (see below).
5. **Page by page** — For each route under `frontend/src/pages/`, apply the standard page template (title, description, primary action, responsive grid/cards).
6. **Pre-ship** — Run through the checklist in DESIGN_TEMPLATE §28 before considering the migration complete.

### Mobile bottom navigation — MOBILE_BOTTOM_NAV_DESIGN.md

DESIGN_TEMPLATE covers layout at a high level; the **glass dock** spec is documented separately.

**[MOBILE_BOTTOM_NAV_DESIGN.md](./MOBILE_BOTTOM_NAV_DESIGN.md)** defines:

| Topic | Detail |
|-------|--------|
| Breakpoint | `768px` — mobile dock below, horizontal scroll dock on tablet/desktop |
| Mobile pattern | 5 tabs + center **Apps** orb + **More** sheet |
| Glass styling | `glassStyles.js`, frosted dock, `TopBar` + content padding |
| Reference files | `BottomNav.jsx`, `navItems.js`, `AppLayout.jsx`, `use-mobile.jsx` |

When reworking navigation during migration, match the **visual spec** in your reference `frontend/src/components/layout/` and update MOBILE_BOTTOM_NAV_DESIGN.md if patterns change. Satellite apps define their own routes in `navItems.js` — do not copy Nexus Brain routes verbatim unless building the hub.

### Reference implementation

The canonical examples live in **`frontend/src/`** — compare new or migrated screens against existing pages that already follow the template (e.g. Dashboard, Links, Settings).

When you change UI patterns in code, update **DESIGN_TEMPLATE.md** so it stays in sync with the reference implementation.

---

## Optional — Nexus SSO (Nexus Brain)

**[nexus-sso-setup.md](./nexus-sso-setup.md)** — portable contract for inbound SSO from **EMZI Nexus Brain** into **any satellite app**. Brain signs a JWT; your app verifies it and issues a local session JWT.

### When to configure

- **Skip** for standalone installs with email/password only.
- **Configure** when users open your app from a Nexus Brain app tile or need “Continue with EMZI Nexus Brain” on the login page.

### How it works

```
Nexus Brain                         Your satellite app
───────────                         ──────────────────
App tile click  ──►  GET /sso/nexus?token=<JWT>&redirect_to=/dashboard
                           │
                           ▼
                     POST /api/sso/nexus/verify
                           │
                     Verify signature, find/create user (nexus_sso_id)
                     Issue Bearer JWT → redirect to SPA route
```

- **Inbound:** Brain → `/sso/nexus` with signed token.
- **Outbound:** Login page links to `VITE_NEXUS_BRAIN_URL`.
- **Sign-out:** SSO users can return to Brain (see nexus-sso-setup.md).

### Prerequisites

Schema and defaults come from migrations + `SettingsSeeder`:

- `users.nexus_sso_id` column
- `settings` row `nexus_sso` (disabled by default)

```bash
npm run migrate
cd backend && php artisan db:seed --class=SettingsSeeder --force
```

### Frontend environment

Add to `frontend/.env` (see `frontend/.env.example`):

```bash
VITE_NEXUS_BRAIN_URL=https://emzinexus.com
```

Production SPA must serve `/sso/nexus` via `index.html` (same `.htaccess` rules as other routes).

### Configure in admin UI

1. Sign in as **admin**.
2. Open **Settings → Security & SSO**.
3. Enable SSO, set shared **secret** and **issuer** to match Brain.
4. Set default role for new SSO users (`user` or `admin`).
5. Copy the **callback URL** shown in the UI (e.g. `https://{frontend-domain}/sso/nexus`) into Brain’s app registration.

### SSO setup checklist

From [nexus-sso-setup.md](./nexus-sso-setup.md):

```
[ ] Migrations run; nexus_sso settings seeded
[ ] Admin enabled SSO with secret + issuer matching Brain
[ ] VITE_NEXUS_BRAIN_URL set in frontend/.env (rebuild for production)
[ ] Callback URL registered in Nexus Brain
[ ] Test: tile click → lands logged in on redirect_to route
[ ] New SSO users get is_approved per your policy (SSO auto-approve vs manual)
```

### Related code

| Piece | Location |
|-------|----------|
| SSO landing page | `frontend/src/pages/SsoNexus.jsx` |
| Login Brain link | `frontend/src/lib/nexusBrain.js` |
| Verify API | `POST /api/sso/nexus/verify` → `SsoController` |
| Admin UI | `frontend/src/components/settings/NexusSsoSettings.jsx` |
| Settings storage | `settings` key `nexus_sso` |

---

## Optional — Event webhooks (Nexus Brain)

Any satellite app can emit **outbound HTTP webhooks** when domain events occur so a central hub such as **EMZI Nexus Brain** can deliver in-app notifications.

The full contract (payload shape, `X-Webhook-Secret`, recipient rules, acceptance tests) is in **[event-webhook-setup.md](./event-webhook-setup.md)**. **All emitters must conform** — event names and nested object keys differ per app, but delivery mechanics are identical.

### When to configure

- **Skip** for local-only dev if you do not need cross-app notifications.
- **Configure** when your app is a Nexus satellite and Brain (or another receiver) should notify users on app events.

### Defaults after seed (Linkly example)

`SettingsSeeder` creates an `event_webhook` row (disabled by default) with these event keys:

| Event | Default subscribed |
|-------|-------------------|
| `link.created` | yes |
| `link.updated` | no |
| `link.deleted` | no |
| `user.registered` | yes |
| `user.approved` | yes |
| `link.metric_threshold` | yes |
| `webhook.test` | yes |

Implementation: `backend/app/Services/EventWebhookService.php` (fire-and-forget `POST`, does not block the main request).

### Configure in the admin UI

1. Sign in as **admin**.
2. Open **Settings → Notifications**.
3. Enable **Event webhooks**, set receiver **URL** (HTTPS in production).
4. Generate or paste a shared **secret** (`whsec_…`, min. 32 characters).
5. Toggle per-event subscriptions and save.

The same values are stored in the `settings` table under key `event_webhook`. Secrets are redacted in API responses (`secret_set: true`).

### Receiver setup checklist

From [event-webhook-setup.md](./event-webhook-setup.md):

```
[ ] Receiver endpoint accepts POST with Content-Type: application/json
[ ] Receiver validates X-Webhook-Secret against the shared secret
[ ] Receiver handles your app's events (see event catalog in admin settings)
[ ] Users have nexus_sso_id when routing to Brain (see nexus-sso-setup.md)
[ ] Send webhook.test from settings → expect 2xx on receiver
```

### Related code

| Piece | Location |
|-------|----------|
| Admin UI | `frontend/src/components/settings/NotificationSettings.jsx` |
| Event list | `frontend/src/lib/settingsConfig.js` (`WEBHOOK_EVENT_OPTIONS`) |
| Settings API | `PATCH /api/settings` with `event_webhook` patch (admin) |
| Delivery | `backend/app/Services/EventWebhookService.php` |

> **Note:** Webhook config uses a UUID `id` per endpoint ([event-webhook-setup.md §2.1](./event-webhook-setup.md#21-webhook-configuration-model)). Sentinel stores **multiple** webhooks in `settings.event_webhook.webhooks[]`. Database **entity and user tables still use integer IDs**, not UUID primary keys.

---

## Optional — MCP API catalog (Nexus Brain AI)

**[emzi-nexus-mcp-catalog-spec.md](./emzi-nexus-mcp-catalog-spec.md)** defines how **every** EMZI satellite app exposes a versioned REST API layer so **EMZI Nexus Brain** can discover and call tools via `GET /api/mcp/v1/catalog`.

Your app is **not** an AI app — it only needs secure `/api/mcp/v1/*` routes that delegate to existing backend services. Brain performs tool-to-REST mapping.

### When to implement

- **Skip** for local-only dev or if Brain does not need to query Linkly programmatically.
- **Implement** when your app should appear as a **Connected System** in Nexus Brain for assistants and automation.

> **Linkly status:** MCP layer is specified in [emzi-nexus-mcp-catalog-spec.md](./emzi-nexus-mcp-catalog-spec.md). Reference apps (e.g. EMZI Nexus Pulse) implement it fully; **Linkly does not yet ship `/api/mcp/v1/` routes** — add them using the spec’s [AI implementation prompt](./emzi-nexus-mcp-catalog-spec.md#ai-implementation-prompt).

### Architecture (after implementation)

```text
Nexus Brain (MCP Server)
      │
      │  1. GET /api/mcp/v1/catalog   (discover APIs)
      │  2. GET/POST /api/mcp/v1/...  (call APIs)
      ▼
Your app Laravel API (MCP middleware + thin controllers)
      │
      ▼
Existing services (EntityService, AuthController, …)
      │
      ▼
MySQL (integer PKs — expose ids as numbers in MCP responses)
```

### Configuration (env + admin settings)

MCP keys merge from **environment** and the `mcp_api` row in the `settings` table:

```bash
# backend/.env (optional at deploy time)
MCP_API_KEY=your-long-random-secret-min-32-chars
MCP_API_KEYS=rotated-key-1,rotated-key-2   # optional comma-separated rotation
MCP_RATE_LIMIT=60
```

| Source | Fields |
|--------|--------|
| `settings.mcp_api` | `api_key` (min. 32 chars), `rate_limit` (requests/min per client) |
| Admin UI | **Settings → MCP API** — Base URL, Catalog URL, generate X-API-Key, rate limit |

Secrets are never returned after save (`api_key_set: true` on read). At least one valid key (32+ characters) is required before Brain can authenticate.

### Register in Nexus Brain

1. Configure your app (admin UI and/or `MCP_API_KEY` in `backend/.env`).
2. In Brain → **Connected Systems**, register:

| Field | Example |
|-------|---------|
| Base URL | `https://{api-domain}` |
| API Key | Same as `MCP_API_KEY` |
| Catalog URL | `https://{api-domain}/api/mcp/v1/catalog` |

3. Verify:

```bash
curl -s -H "X-API-Key: YOUR_KEY" \
  https://{api-domain}/api/mcp/v1/catalog
```

Expected: HTTP 200, `success: true`, and a `data` array of endpoint definitions.

### Implementation checklist

From [emzi-nexus-mcp-catalog-spec.md](./emzi-nexus-mcp-catalog-spec.md):

```
[ ] GET /api/mcp/v1/catalog — standard { success, data, meta } envelope
[ ] All MCP routes under /api/mcp/v1/ (versioned only)
[ ] Auth: X-API-Key (server-to-server) and/or Bearer JWT with permissions
[ ] mcp_api settings + MCP_API_KEY env merged at runtime
[ ] Rate limiting on /api/mcp/v1/* (default 60/min)
[ ] Thin controllers → existing services (EntityService, etc.)
[ ] Catalog documents every exposed endpoint (params, examples, errors)
[ ] Tests: auth, validation, success/error responses
```

Use the spec’s **[AI implementation prompt](./emzi-nexus-mcp-catalog-spec.md#ai-implementation-prompt)** when building the Laravel MCP layer. Reference implementation paths are listed under [Reference: EMZI Nexus Pulse](./emzi-nexus-mcp-catalog-spec.md#reference-emzi-nexus-pulse) (adapt Node paths to `backend/routes/`, `backend/app/Services/`, etc.).

### Related Nexus integrations

| Integration | Direction | Doc |
|-------------|-----------|-----|
| MCP catalog | Brain **calls** your app APIs | [emzi-nexus-mcp-catalog-spec.md](./emzi-nexus-mcp-catalog-spec.md) |
| Event webhooks | Your app **pushes** events to Brain | [event-webhook-setup.md](./event-webhook-setup.md) |
| Nexus SSO | Brain **redirects** users into your app | [nexus-sso-setup.md](./nexus-sso-setup.md) |

---

## Database design — no UUID primary keys

**Required for all EMZI Laravel satellite apps:** do **not** use UUID columns as primary keys on application tables.

| Table (Linkly example) | Primary key | Notes |
|-------|-------------|-------|
| `users` | `id` BIGINT | Auto-increment |
| `entity_shortlink`, `entity_campaign`, … | `id` BIGINT | Payload in JSON column |
| `audit_logs` | `id` BIGINT | `actor_user_id` / `target_user_id` are BIGINT FKs |
| `user_notifications` | `id` BIGINT | `user_id`, `link_id`, `rule_id` are BIGINT |
| `settings` | `key` string | Key-value store, not UUID-based |

Migrations use Laravel’s `$table->id()` (MySQL `BIGINT UNSIGNED AUTO_INCREMENT`).

**UUIDs are still used where appropriate for opaque tokens**, not row identity:

- Password reset tokens (`reset_token`) — random string via `IdGenerator`
- Uploaded file names — `Str::uuid()` in `UploadController`
- Client-side ephemeral IDs (e.g. notification rule UI) — `crypto.randomUUID()` in the browser only

`EntityService` returns numeric IDs to the frontend:

```php
'id' => (int) $row->id,
```

Foreign references in JSON payloads (`campaign_id`, etc.) should store **integer IDs** as strings or numbers consistent with the API response.

### Relational tables vs JSON payloads

**Do not store structured domain data as JSON blobs** when the shape is known and relational. Use proper MySQL tables with typed columns and one-to-one or one-to-many relationships.

| Pattern | When to use | Example (Sentinel) |
|---------|-------------|---------------------|
| **One-to-many** | Child records owned by a parent | `user_notifications.user_id` → user |
| **JSON `payload` in `entity_*`** | Flexible entity records with typed service layer | `entity_domain`, `entity_alertsetting`, … |
| **`settings` key-value JSON** | Small admin config blobs (SSO secrets, webhook toggles) | `nexus_sso`, `event_webhook`, `general` |

When adding new features, prefer dedicated tables + services over stuffing fields into `settings.value` or `entity_*.payload`.

---

## Prerequisites

- **Node.js** 18+
- **PHP** 8.3+ with extensions: `mbstring`, `openssl`, `pdo_mysql`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`
- **Composer** 2.x
- **MySQL** 8+
- Optional: [Laravel Herd](https://herd.laravel.com) (Linkly: `~/Herd/linkly` → `linkly.test`)

---

## Initial setup (fresh install)

### 1. Clone and install dependencies

```bash
git clone <repository-url> {app}
cd {app}
npm run install:all
```

This runs `npm install` at the root and in `frontend/`, and `composer install` in `backend/`.

### 2. Create the database

```sql
CREATE DATABASE IF NOT EXISTS {db_name}
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 3. Configure backend

```bash
cp backend/.env.example backend/.env
cd backend && php artisan key:generate --ansi && cd ..
```

Edit `backend/.env`:

```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE={db_name}
DB_USERNAME=root
DB_PASSWORD=your_password

JWT_SECRET=replace_with_a_long_random_secret_at_least_32_chars
ADMIN_EMAIL=admin@admin.com
ADMIN_PASSWORD=password
APP_BASE_URL=http://localhost:5180
FRONTEND_URL=http://localhost:5180
APP_TIMEZONE=UTC
```

### 4. Configure frontend

```bash
cp frontend/.env.example frontend/.env
```

Default local values:

```bash
VITE_API_BASE_URL=/api
VITE_DEV_API_TARGET=http://127.0.0.1:8010
VITE_APP_TIMEZONE=UTC
```

Vite proxies `/api` to Laravel during development (see `frontend/vite.config.js`).

### 5. Migrate and seed

```bash
npm run migrate
npm run seed
cd backend && php artisan storage:link && cd ..
```

`storage:link` exposes uploaded files (e.g. QR logos) at `/storage/...` on the API host. Required for logo uploads in production.

This creates all tables (integer PKs) and seeds:

- Default settings (`SettingsSeeder`)
- Admin user (`AdminUserSeeder`): `admin@admin.com` / `password` by default (override with `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

### 6. Start development servers

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5180 |
| Laravel API | http://127.0.0.1:8010 |

Sign in with `admin@admin.com` / `password` (or your `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`).

### 7. Optional — Laravel Herd (Linkly example)

If the repo lives under `~/Herd/{app}`, Herd can serve the API at `http://{app}.test`. Set in `frontend/.env`:

```bash
VITE_DEV_API_TARGET=http://{app}.test
```

### Dev scripts (optional)

See [DEV.md](./DEV.md) for full local development requirements.

```bash
npm run dev:frontend   # Vite only
npm run dev:api          # Laravel only (port 8010)
npm run lint             # ESLint on frontend
```

---

## Post-install admin configuration

After `npm run seed`, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` and complete these steps before inviting users.

### User approval workflow

New registrations set `is_approved = false`. Until an admin approves them:

- Users see **Account Pending Approval** after login attempt.
- JWT middleware blocks API access for unapproved accounts.

**Admin:** open **User Management** → approve users (toggle approval). SSO-created users may be auto-approved depending on Brain policy — see [nexus-sso-setup.md](./nexus-sso-setup.md).

The seeded admin from `AdminUserSeeder` is pre-approved.

### Email and password reset

Password reset uses Laravel mail. Default `MAIL_MAILER=log` writes messages to logs only — fine for local dev.

**Production** — configure SMTP in `backend/.env`:

```bash
MAIL_MAILER=smtp
MAIL_HOST=your-smtp-host
MAIL_PORT=587
MAIL_USERNAME=your-user
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=no-reply@yourdomain.com
MAIL_FROM_NAME="${APP_NAME}"
```

**Local testing without SMTP** — return the reset token in the API response:

```bash
DEV_SHOW_RESET_TOKEN=true
```

Then `POST /api/auth/forgot-password` includes `reset_token` in JSON for copy/paste into the reset form.

### Settings tabs (admin only)

Configure under **Settings** (`frontend/src/lib/settingsConfig.js`):

| Tab | Purpose |
|-----|---------|
| **General** | Organization name, default domain, brand color (`BRAND_PRIMARY`), timezone |
| **Security & SSO** | Nexus SSO secret, issuer, default role — [nexus-sso-setup.md](./nexus-sso-setup.md) |
| **Notifications** | Outbound event webhooks — [event-webhook-setup.md](./event-webhook-setup.md) |
| **MCP API** | Nexus Brain connected system API key and rate limit |

API: `GET` / `PATCH /api/settings` (admin JWT required). Secrets are redacted on read (`secret_set`, `api_key_set`).

### Other backend env vars

| Variable | Purpose |
|----------|---------|
| `BRAND_PRIMARY` | Default teal brand color (overridable in General settings) |
| `DOMAIN_VERIFY_PREFIX` | DNS TXT prefix for custom domain verification (default `_linkly`) |
| `JWT_SECRET` | Signing key for session tokens — must be strong in production |
| `FRONTEND_URL` | CORS allowed origin(s) for `/api/*`, comma-separated |

---

## Linkly features overview

**Linkly example only** — core product behavior beyond auth and entity CRUD. Other satellite apps replace this section with their own domain checklist.

### Short links and public redirects

| Feature | Detail |
|---------|--------|
| **Dashboard / Links** | CRUD for `ShortLink` entities |
| **Public route** | `/r/:slug` — `RedirectPage.jsx` resolves slug and redirects (no login required) |
| **Campaigns** | Group links under `Campaign` entities |
| **A/B testing** | `ABVariant` entities + AB Testing page |
| **Smart redirects** | `RedirectRule` entities (geo, device, time rules) |
| **Analytics** | Click logs, charts, referrer/device breakdowns |
| **QR codes** | Org default in `organization_qr_defaults`; per-link designs in `qr_designs` (one-to-many). User decisions require confirmation — see [DESIGN_TEMPLATE.md §11.3](./DESIGN_TEMPLATE.md#113-alertdialog-and-user-decisions-confirm-required) |

### Custom domains

**Domains** page manages `CustomDomain` entities. Verification uses a DNS TXT record:

- Prefix from `DOMAIN_VERIFY_PREFIX` (default `_linkly`)
- API: `POST /api/domains/{id}/verify` (authenticated)

Point DNS at your infrastructure before marking a domain primary.

### Notifications (in-app)

Linkly delivers **in-app notifications** to subscribed users when link metric rules fire.

| Piece | Detail |
|-------|--------|
| **Rules** | `LinkNotificationRule` entity — metric thresholds, subscriber user IDs |
| **Service** | `LinkNotificationService` evaluates rules on click/conversion events |
| **Storage** | `user_notifications` table (integer `id`, `user_id`, `link_id`, `rule_id`) |
| **API** | `GET /api/notifications`, poll, mark read — `NotificationController` |
| **UI** | Notification bell in `TopBar`, `useInAppNotifications` hook |

Configure rules per link in the link detail UI (`LinkNotificationManager`). This is separate from **outbound event webhooks** (Brain integration).

### Audit trails (admin)

Administrative actions are recorded for compliance and debugging.

| Piece | Detail |
|-------|--------|
| **Storage** | `audit_logs` table — `actor_user_id`, `action`, `target_user_id`, `details` JSON |
| **Service** | `AuditLogService` — entity create/update/delete, user approval, role changes, settings patches, password reset requests |
| **API** | `GET /api/admin/audit-logs` (admin only) |
| **UI** | **Audit Logs** page — filterable history with entity snapshots |

Sensitive fields (passwords, tokens, secrets) are stripped before persistence.

### Feature verification checklist

```
[ ] Create short link → appears in Links; row in entity_shortlink with integer id
[ ] Open /r/{slug} in incognito → redirects to destination
[ ] Add link notification rule → threshold triggers in-app notification (bell)
[ ] Admin: approve a new user → user can access dashboard
[ ] Admin: Audit Logs shows entity_created / user_approval_updated entries
[ ] Optional: custom domain verify flow completes
```

---

## Verify the migration

1. **Health** — `GET http://127.0.0.1:8010/api/health` returns JSON.
2. **Login** — Use admin email/password; token is stored in `localStorage` (Linkly: `linkly_access_token`; use a consistent key per app).
3. **Entities** — Create a short link in the UI; confirm `entity_shortlink` row has numeric `id`.
4. **No Base44** — `package.json` / `frontend/package.json` must not list `@base44/*`; grep the repo for `base44` should return nothing in application code.
5. **UI template** — Pages use shadcn/ui, design tokens, and layout patterns from [DESIGN_TEMPLATE.md](./DESIGN_TEMPLATE.md); mobile dock per [MOBILE_BOTTOM_NAV_DESIGN.md](./MOBILE_BOTTOM_NAV_DESIGN.md); pass DESIGN_TEMPLATE §28.
6. **Notifications & audit** — Link rules fire in-app notifications; Audit Logs records admin actions.
7. **SPA routing (production)** — After deploy, direct `/login` and refresh on inner routes work; see [REACT_SPA_APACHE_HTACCESS.md](./REACT_SPA_APACHE_HTACCESS.md).

---

## Migrating existing Base44 / Express data (optional)

If you have data from Base44 or the old Node `server/` with **string UUID primary keys**, you cannot copy rows directly into the new schema without a one-time migration script.

Recommended approach:

1. **Fresh schema** — `npm run migrate` on an empty database.
2. **Export** entity rows from the old system (CSV or JSON per entity).
3. **Re-import** via the API (`POST /api/entities/{Entity}`) so Laravel assigns new integer IDs.
4. **Remap foreign keys** in payloads (`campaign_id`, `link_id`, etc.) to the new integer IDs.
5. **Users** — Re-register or insert via seeders; passwords must be re-hashed with bcrypt in Laravel.

Do **not** alter migrations to use `uuid` primary keys — the frontend and `EntityService` expect integer IDs.

---

## Entity list (Linkly example)

Entities are registered in `backend/config/linkly.php` and mirrored in `frontend/src/api/openClient.js`:

| Entity | Table |
|--------|-------|
| ABVariant | `entity_abvariant` |
| Campaign | `entity_campaign` |
| ClickLog | `entity_clicklog` |
| CustomDomain | `entity_customdomain` |
| QRDesign | `qr_designs` (relational; API entity name `QRDesign`) |
| LinkNotificationRule | `entity_linknotificationrule` (+ dedicated migration) |
| RedirectRule | `entity_redirectrule` |
| ShortLink | `entity_shortlink` |

JSON schemas under `frontend/entities/` describe each entity’s fields (carried over from Base44) but are **not** read at runtime by Laravel.

---

## Production deployment — React SPA on Apache

After local setup works, deploy the frontend and API to production. Full details, troubleshooting, and Nginx/subpath notes are in **[REACT_SPA_APACHE_HTACCESS.md](./REACT_SPA_APACHE_HTACCESS.md)** — follow that checklist on every Apache or cPanel deploy.

### Why `.htaccess` matters

Linkly uses **React Router** (`BrowserRouter`). Without rewrite rules, direct visits or refreshes on routes like `/login` or `/links/abc` return **Apache 404** because the server looks for real files instead of serving `index.html`.

| Action | Without `.htaccess` |
|--------|---------------------|
| Open `/` | Works (`index.html` loads) |
| Click **Login** in the app | Works (client router) |
| Refresh on `/login` or open `/login` in a new tab | **404** |

### Build and deploy the frontend

1. **Template** — `frontend/.htaccess` (version controlled).
2. **Build** — `npm run build` runs `vite build && cp .htaccess dist/.htaccess` (see `frontend/package.json`).
3. **Upload** — Deploy the **contents** of `frontend/dist/` to the frontend web root, including the hidden **`.htaccess`** file.

Confirm Apache has `mod_rewrite` and `AllowOverride` enabled (normal on shared hosting).

### Split domains (SPA + API on different hosts)

Typical production layout:

| Role | Example URL | Deploy |
|------|-------------|--------|
| Frontend (SPA) | `https://{app}.example.com` | `frontend/dist/` |
| Backend (Laravel API) | `https://api.{app}.example.com` | `backend/` with document root `backend/public` |

**Do not** use `VITE_API_BASE_URL=/api` when the SPA and API are on different hosts. The SPA `.htaccess` will serve `index.html` for `/api/*`, so login returns HTML instead of JSON.

**Before building**, set `frontend/.env`:

```bash
VITE_API_BASE_URL=https://api.{app}.example.com/api
VITE_NEXUS_BRAIN_URL=https://{nexus-brain-domain}
VITE_APP_TIMEZONE=UTC

npm run build
```

Vite bakes `VITE_*` into the JS bundle at build time — changing server env after deploy does nothing until you rebuild.

**On the API server**, set `backend/.env`:

```bash
APP_URL=https://api.{app}.example.com
APP_BASE_URL=https://{app}.example.com
FRONTEND_URL=https://{app}.example.com
```

Then run `php artisan config:clear`. `FRONTEND_URL` controls CORS for browser requests from the SPA origin on `/api/*`.

On **split domains**, uploaded QR logos are served from `APP_URL/storage/...`. The API must allow cross-origin access to those static files (Apache: `mod_headers` + repo `.htaccess` rules) and have `php artisan storage:link` run once. See [REACT_SPA_APACHE_HTACCESS.md § Uploaded logos](./REACT_SPA_APACHE_HTACCESS.md#uploaded-logos-and-storage-split-domains).

### Production checklist

```
[ ] npm run build completed; frontend/dist/.htaccess exists next to index.html
[ ] Deployed dist/ includes hidden files (.htaccess)
[ ] Split domains: VITE_API_BASE_URL points to API host (not /api on SPA host)
[ ] Split domains: backend FRONTEND_URL matches SPA origin
[ ] API server: php artisan storage:link; CORS on /storage/* for QR logos — REACT_SPA_APACHE_HTACCESS.md
[ ] Laravel: strong JWT_SECRET, APP_DEBUG=false, SMTP configured
[ ] php artisan migrate --force on API server
[ ] Direct URL test: /login loads (not 404)
[ ] Refresh test: inner route + F5 still loads
[ ] Login test: /api/* hits API subdomain and returns JSON
[ ] UI passes DESIGN_TEMPLATE.md §28 pre-ship checklist
```

### Verify after deploy

1. Open the home page — should load.
2. Open `https://your-domain.com/login` directly — login page, not Apache 404.
3. Log in, navigate to an inner route, **refresh** — route should persist.
4. DevTools → Network: JS/CSS return **200**; API calls go to the **API host** and return JSON.

Quick API check:

```bash
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" \
  -X POST https://api.{app}.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
```

Expect `401 application/json`, not `200 text/html`.

For symptom → fix tables (404 on routes, HTML from API, CORS errors), see [REACT_SPA_APACHE_HTACCESS.md § Troubleshooting](./REACT_SPA_APACHE_HTACCESS.md#troubleshooting).

### Backend-only items

- Set strong `JWT_SECRET`, disable `APP_DEBUG`, configure SMTP in `backend/.env`.
- Run migrations on deploy: `cd backend && php artisan migrate --force`.
- Run once per API deploy: `cd backend && php artisan storage:link` (serves uploaded logos at `/storage/...`).
- **Cron for alert checks:** `* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1` — runs daily `sentinel:check-alerts` (see [DEV.md](./DEV.md#automatic-alert-checks)).
- Split domains: ensure CORS headers on `/storage/*` (repo `.htaccess` + Apache `mod_headers`, or Nginx `add_header`) — see [REACT_SPA_APACHE_HTACCESS.md](./REACT_SPA_APACHE_HTACCESS.md#uploaded-logos-and-storage-split-domains).

---

## Related documentation

| Topic | Document |
|-------|----------|
| **Documentation index (start here)** | [docs/README.md](./README.md) |
| Daily dev & deploy | [README.md](../README.md) |
| **UI / system template (required — all apps)** | [DESIGN_TEMPLATE.md](./DESIGN_TEMPLATE.md) |
| SPA Apache deploy & split domains (required for production) | [REACT_SPA_APACHE_HTACCESS.md](./REACT_SPA_APACHE_HTACCESS.md) |
| Mobile glass dock navigation | [MOBILE_BOTTOM_NAV_DESIGN.md](./MOBILE_BOTTOM_NAV_DESIGN.md) |
| Nexus SSO (optional — Brain login) | [nexus-sso-setup.md](./nexus-sso-setup.md) |
| Event webhooks (optional — Brain notifications) | [event-webhook-setup.md](./event-webhook-setup.md) |
| MCP API catalog (optional — Brain AI / tools) | [emzi-nexus-mcp-catalog-spec.md](./emzi-nexus-mcp-catalog-spec.md) |
