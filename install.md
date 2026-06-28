# EMZI Nexus — Installation & Redeploy Guide

Use this document as the **single checklist** when setting up a new server or redeploying production. Work through each section in order and tick items off so nothing is missed.

**Related docs (detail, not duplicate):**

- [docs/WEB_PUSH_DEPLOYMENT.md](docs/WEB_PUSH_DEPLOYMENT.md) — Web Push testing, browser quirks, debugging
- [docs/SSO_INTEGRATION_GUIDE.md](docs/SSO_INTEGRATION_GUIDE.md) — SSO for connected applications

---

## Quick redeploy checklist

Copy this block for every production deploy:

```
[ ] git pull / upload release
[ ] cd backend && composer install --no-dev --optimize-autoloader
[ ] cd backend && php artisan migrate --force
[ ] cd backend && php artisan config:cache && php artisan route:cache
[ ] cd frontend && npm ci && npm run build
[ ] Deploy frontend/dist to web root (see §7)
[ ] Confirm backend/.env values (§4)
[ ] Confirm frontend build env VITE_API_BASE_URL (§5)
[ ] Cron: * * * * * php artisan schedule:run (§8)
[ ] Queue worker: --queue=mail-inbox,default (§9)
[ ] PHP IMAP extension enabled (§3)
[ ] Web Push VAPID keys set (§10)
[ ] Admin → Email settings: SMTP + IMAP host (§11)
[ ] Post-deploy smoke tests (§13)
```

---

## 1. Architecture overview

| Component | Path | Role |
|-----------|------|------|
| Backend API | `backend/` | Laravel 12 API, queues, scheduler, IMAP mail |
| Frontend SPA | `frontend/` | React + Vite; build output in `frontend/dist/` |
| Service worker | `frontend/public/sw.js` | PWA shell + Web Push (copied to `dist/` on build) |

**Typical production layout**

- **Frontend:** `https://emzinexus.com` → serves `frontend/dist/`
- **API:** `https://brainapi.emzinexus.com` → Laravel `backend/public/`
- Or combined: API proxied under `/api` on the same domain

---

## 2. Server prerequisites

### PHP (backend)

- **PHP 8.2+**
- **Composer 2.x**
- Extensions (required or strongly recommended):
  - `pdo_mysql` (or your DB driver)
  - `openssl`
  - `mbstring`
  - `tokenizer`
  - `xml`
  - `ctype`
  - `json`
  - `fileinfo`
  - **`imap`** — required for in-app Email (staff mailboxes)

Install IMAP (examples):

```bash
# Ubuntu/Debian
sudo apt install php8.2-imap && sudo systemctl restart php8.2-fpm

# macOS (Homebrew PHP)
pecl install imap
# or use a PHP build that includes --with-imap
```

Verify:

```bash
php -m | grep imap
```

### Node.js (frontend build)

- **Node 20+** and **npm** (or compatible LTS)
- Only needed on the build machine if you build locally and upload `dist/`

### Database

- **MySQL 8+** (or MariaDB) recommended
- SQLite is fine for local dev only

### HTTPS

- **Required in production** for Web Push, PWA install, and secure cookies
- Local dev may use `http://localhost` with limitations for push

---

## 3. First-time backend setup

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
```

Edit `backend/.env` (see §4), then:

```bash
php artisan migrate
php artisan storage:link   # if using local file storage for uploads
```

Optional local dev (runs API, queue, logs, Vite together):

```bash
cd backend && composer dev
```

> **Note:** `composer dev` runs `queue:listen` on the **default** queue only. For local mail-push testing, run a separate worker (§9) or use `mail:check-inbox-push --sync`.

---

## 4. Backend environment (`.env`)

Minimum production variables:

```env
APP_NAME="EMZI Nexus Brain"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://brainapi.emzinexus.com

# Frontend origin (CORS, redirects, OAuth)
FRONTEND_URL=https://emzinexus.com

# When API and frontend are on different hosts (recommended in production)
# MCP_PUBLIC_URL=https://emzinexus.com

APP_KEY=base64:...   # from php artisan key:generate

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nexus
DB_USERNAME=...
DB_PASSWORD=...

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=database

# Web Push (required for notifications when app is closed)
WEB_PUSH_SUBJECT=mailto:admin@yourdomain.com
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=

# Optional integrations
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

Generate VAPID keys once (keep the same keys across redeploys unless compromised):

```bash
cd backend && php artisan tinker
```

```php
use Minishlink\WebPush\VAPID;
$keys = VAPID::createVapidKeys();
echo "Public:  {$keys['publicKey']}\n";
echo "Private: {$keys['privateKey']}\n";
exit;
```

After changing `.env` in production:

```bash
php artisan config:clear
php artisan config:cache
```

---

## 5. Frontend environment & build

Create `frontend/.env` (or `frontend/.env.production`) **before** `npm run build`:

```env
# Empty string = same origin as the SPA (when API is proxied at /api)
# Production split-host example:
VITE_API_BASE_URL=https://brainapi.emzinexus.com

# Optional branding
VITE_SYSTEM_NAME=EMZI Nexus Brain
```

Build:

```bash
cd frontend
npm ci
npm run build
```

Output: `frontend/dist/` (includes `index.html`, assets, `sw.js`, icons).

---

## 6. Admin settings (database)

After deploy, log in as **admin** → **Settings** and configure:

| Setting | Purpose |
|---------|---------|
| System name, branding | App title, PWA manifest |
| SMTP host/port/encryption | Nexus system emails (password reset, alerts) |
| **IMAP host/port/encryption** | Staff in-app Email (e.g. `harpy.awedns.com`, port `993`, SSL) |
| Splash / PWA assets | Install experience |

**Mail server notes (production):**

- Use the **real mail server hostname** (e.g. `harpy.awedns.com`), not a Cloudflare-proxied `mail.domain` if IMAP times out
- SMTP: typically port `587` + TLS; IMAP: port `993` + SSL

Staff connect their own mailbox password in **Email** → Connect (password stored encrypted; mail stays on the mail server).

---

## 7. Web server / static frontend

Point the **public site** document root to **`frontend/dist`**.

### Apache — SPA fallback (required)

Add `.htaccess` inside `frontend/dist` (or your deployed dist folder):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

Without this, direct URLs like `/email/123` return **404**.

### Laravel API

Point the API vhost to `backend/public/`.

Ensure `/api/*` routes reach Laravel. If frontend and API share a domain, reverse-proxy `/api` to the backend.

### Verify after deploy

- `https://yoursite.com/sw.js` — service worker loads (200)
- `https://yourapi.com/api/pwa/manifest` — PWA manifest JSON
- `https://yourapi.com/api/health` or login page works

---

## 8. Laravel scheduler (cron) — required

Several features depend on the scheduler. **Without cron, they silently stop working.**

| Command | Interval | Purpose |
|---------|----------|---------|
| `attendance:send-reminders` | Every 5 min | Clock in/out reminders |
| `applications:check-health` | Every 5 min | Application health probes |
| `mail:check-inbox-push` | Every 2 min | Queue mail inbox Web Push jobs |
| `conversations:prune-empty` | Hourly | Message cleanup |

Add to the server crontab (use the **backend** path):

```cron
* * * * * cd /path/to/nexus/backend && php artisan schedule:run >> /dev/null 2>&1
```

Verify:

```bash
cd backend
php artisan schedule:list
php artisan schedule:run -v
```

Manual mail push dispatch (queues jobs; does not IMAP inline):

```bash
php artisan mail:check-inbox-push
php artisan mail:check-inbox-push --sync   # debug: run inline, no queue
```

---

## 9. Queue worker — required

`QUEUE_CONNECTION=database` is the default. Background jobs include:

- **Mail inbox push** (`mail-inbox` queue)
- Other Laravel jobs (`default` queue)

### Production worker command

**Update your existing worker** (do not run two workers on `default` unless you want extra parallelism):

```bash
php artisan queue:work database --queue=mail-inbox,default --sleep=3 --tries=2
```

- `mail-inbox` is processed **first**, then `default`
- Restart this process after every deploy

### Supervisor example

`/etc/supervisor/conf.d/nexus-worker.conf`:

```ini
[program:nexus-queue]
process_name=%(program_name)s
command=php /path/to/nexus/backend/artisan queue:work database --queue=mail-inbox,default --sleep=3 --tries=2
directory=/path/to/nexus/backend
autostart=true
autorestart=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/log/nexus-queue.log
stopwaitsecs=3600
```

```bash
sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl restart nexus-queue
```

### Verify queue is draining

```bash
cd backend
php artisan mail:check-inbox-push
php artisan queue:work database --queue=mail-inbox --once
```

Check pending jobs:

```sql
SELECT queue, COUNT(*) FROM jobs GROUP BY queue;
```

If rows sit on `mail-inbox` and never decrease, the worker is **not** listening to that queue.

---

## 10. Web Push & mail notifications (user-facing)

### Server

1. VAPID keys in `backend/.env` (§4)
2. Cron + queue worker running (§8, §9)
3. HTTPS in production

### Each staff user

1. **Settings → New inbox alerts** — ON
2. **Settings → Web push** — enable + allow browser permission
3. **Email** — connect mailbox

| Scenario | What delivers the alert |
|----------|-------------------------|
| App closed | Server IMAP job → Web Push → service worker |
| App open, Web Push on | Web Push (client polling disabled to avoid duplicates) |
| App open, Web Push off | Browser polls inbox (~30s) |

See [docs/WEB_PUSH_DEPLOYMENT.md](docs/WEB_PUSH_DEPLOYMENT.md) for browser testing and troubleshooting.

---

## 11. Standard production deploy steps

```bash
# 1. Code
cd /path/to/nexus
git pull origin main

# 2. Backend
cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 3. Frontend
cd ../frontend
npm ci
npm run build

# 4. Publish dist (example: rsync or CI artifact)
rsync -av --delete dist/ /var/www/emzinexus/

# 5. Restart services
sudo supervisorctl restart nexus-queue
sudo systemctl reload php8.2-fpm   # or your PHP service
```

---

## 12. Post-deploy smoke tests

```
[ ] Login / logout works
[ ] Admin settings save (SMTP/IMAP)
[ ] Staff can connect Email mailbox
[ ] Send a test system notification with Web Push enabled
[ ] Receive Web Push when browser tab is closed
[ ] Send yourself email → notification within ~2–3 min (mail push)
[ ] Click notification → opens /email/{uid}
[ ] PWA install / sw.js loads
[ ] Attendance reminders still fire (if used)
[ ] php artisan schedule:list shows all 4 scheduled commands
[ ] jobs table: mail-inbox queue drains after mail:check-inbox-push
```

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Email page 422 on connect | Wrong IMAP host / DNS | Admin IMAP host → real server (e.g. `harpy.awedns.com`) |
| `PHP IMAP extension is not installed` | Missing `ext-imap` | Install php-imap, restart PHP-FPM |
| No push when app closed | Queue not processing `mail-inbox` | Worker `--queue=mail-inbox,default` |
| No push at all | Missing VAPID keys or HTTPS | Set `WEB_PUSH_*`, use HTTPS |
| Mail push never runs | Cron missing | Add `schedule:run` crontab |
| Jobs pile up | Worker down or wrong queue | Restart supervisor worker |
| `/email/123` 404 on refresh | SPA rewrite missing | Add `.htaccess` in dist (§7) |
| Old mail floods notifications | Watch state reset | Reconnect mailbox once; first scan seeds silently |

Logs:

```bash
tail -f backend/storage/logs/laravel.log
```

---

## 14. Local development (Laravel Herd / Valet)

- Point a Herd site at `backend/public` for the API
- Run `cd frontend && npm run dev` for the SPA (proxies `/api` to `:8000` per `vite.config.js`)
- Use `composer dev` from `backend/` for an all-in-one dev stack
- For mail push locally: run `php artisan queue:work database --queue=mail-inbox,default` in a second terminal

---

*Last updated: includes queued mail inbox push (`mail-inbox` queue), scheduler `mail:check-inbox-push`, and Web Push background notifications.*
