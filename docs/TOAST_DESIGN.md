# Toast Design & Error Messaging

Portable spec for **user-facing toasts** in Care (and sibling Nexus apps). Toasts must help normal users recover — never expose HTTP status codes, stack traces, raw vendor payloads, or developer jargon.

**Reference implementation:**

| File | Purpose |
|------|---------|
| `frontend/src/components/ui/sonner.jsx` | Sonner toaster shell (theme, position, glass styles) |
| `frontend/src/lib/toastApi.js` | `toastApiError()` — preferred catch-block helper |
| `frontend/src/lib/userFacingError.js` | Sanitize / rewrite API messages; status fallbacks |
| `frontend/src/api/http.js` | Builds `ApiError.message` via the same sanitizer |
| `frontend/src/lib/whatsappShareToast.js` | Success toast with action button |
| `docs/DESIGN_TEMPLATE.md` §18 | Visual toaster settings (position, `richColors`) |

---

## 1. Goals

1. **Plain language** — a non-technical agent should know what went wrong and what to do next.
2. **No status codes in UI** — never show `422`, `Request failed (422)`, `HTTP 401`, etc.
3. **Actionable when possible** — especially cookie / sync failures (“paste a fresh cookie…”).
4. **One system** — Sonner only (`import { toast } from 'sonner'`). Do not use Radix/`use-toast` or `react-hot-toast` for new work.
5. **Central mapping** — prefer rewriting in `userFacingError.js` / backend messages over one-off copy in every page.

---

## 2. Visual design

Matches `sonner.jsx` / DESIGN_TEMPLATE §18:

| Setting | Value |
|---------|-------|
| Library | [Sonner](https://sonner.emilkowalski.dev/) |
| Position | `top-right` |
| Theme | Follows `next-themes` |
| Style | Glass panel (`glassPanelStyles`), `richColors`, close button |
| Variants | `success`, `error`, `info` (use `warning` sparingly if needed) |

**Copy length**

| Part | Guidance |
|------|----------|
| Title / main message | One short sentence (≈ 6–16 words) |
| Description (optional) | Only when it adds a clear next step |
| Avoid | Multi-paragraph dumps, JSON, HTML, HTTP snippets |

**Duration**

| Kind | Duration |
|------|----------|
| Success (simple) | Default Sonner |
| Error | Default Sonner (user can dismiss) |
| Action toast (e.g. WhatsApp share) | Longer (`12000` ms) with explicit action |

---

## 3. When to toast

| Situation | Variant | Notes |
|-----------|---------|-------|
| Action succeeded | `toast.success` | Confirm what changed (“Role updated”) |
| Action failed (API / network) | `toastApiError(err, fallback)` | Always sanitize |
| Client validation before submit | `toast.error('…')` | Fixed, friendly copy is fine |
| Soft notice / unavailable feature | `toast.info` | e.g. “Snooze is not available yet” |
| Destructive confirm | Dialog / AlertDialog | **Not** toast-only |

Do **not** toast raw `error.message` from `catch` blocks.

---

## 4. Error message logic

### 4.1 Flow

```
API / throw
    → http.js ApiError (message already sanitized)
    → catch
    → toastApiError(error, 'Failed to …')
         → getUserFacingError()
              1. Rewrite known cookie / sync patterns
              2. Strip trailing vendor noise: "Friendly. (raw…)"
              3. Reject technical strings (status codes, HTTP, HTML, JSON, huge text)
              4. Else status fallback (401 / 403 / 422 / 5xx …)
              5. Else caller fallback
```

### 4.2 Status fallbacks (never include the number in the string)

| Status | User message |
|--------|----------------|
| 400 | Something was wrong with that request. Please check and try again. |
| 401 / 419 | Please sign in again… / session expired |
| 403 | You don't have permission to do that. |
| 404 | We couldn't find what you were looking for. |
| 413 | The file is too large. Maximum size is 10 MB. |
| **422** | We couldn't complete that request. Please check your details and try again. |
| 429 | Too many requests. Please wait a moment and try again. |
| 5xx | Something went wrong on the server. Please try again. |

Laravel field errors (`errors.email[0]`, etc.) are shown when they are already human-readable. Generic `"The given data was invalid."` is **not** shown — use the 422 fallback instead.

### 4.3 Cookie / marketplace sync (high priority)

Sync and cookie APIs often return **HTTP 422**. Users must never see “error 422”.

| Cause | Toast direction |
|-------|-----------------|
| Cookie missing | Point them to Marketplace → TikTok Shop / Shopee to add a cookie |
| Cookie expired / invalid | Ask them to paste a **fresh** Seller Center cookie |
| Shop id not in cookie | Open the correct shop, re-copy Cookie header |
| Seller Center unreachable / bad payload | “Check your shop cookie and try again” — no HTTP body snippets |

Backend clients must throw **friendly** `RuntimeException` messages (no `(vendor message)` suffixes, no `HTTP {$status}: {$snippet}`). Frontend still sanitizes as a safety net.

### 4.4 What counts as “technical” (rewrite or drop)

- `Request failed (422)` / any `Request failed (N)`
- `HTTP 401`, status codes in the string
- Raw response body / HTML / JSON blobs
- Exception class names, SQLSTATE, connection errors (`ECONNREFUSED`, …)
- Messages longer than ~280 characters

---

## 5. Usage patterns

### Preferred (API failures)

```js
import { toast } from 'sonner';
import { toastApiError } from '@/lib/toastApi';

try {
  await save();
  toast.success('Settings saved');
} catch (err) {
  toastApiError(err, 'Failed to save settings');
}
```

### Client validation (fixed copy)

```js
if (!cookie.trim()) {
  toast.error('Paste a Seller Center cookie');
  return;
}
```

### When you need the string (inline UI + toast)

```js
import { getUserFacingError } from '@/lib/userFacingError';

const message = getUserFacingError(err, `Failed to upload "${file.name}"`);
setUploadError(message);
toast.error(message);
```

### Success with action

```js
import { offerWhatsappShareToast } from '@/lib/whatsappShareToast';

offerWhatsappShareToast(complaint, { event: 'created' });
```

---

## 6. Copy checklist

Before shipping a toast:

- [ ] No HTTP status codes or `Request failed (…)`
- [ ] No stack traces, JSON, or HTML
- [ ] Mentions a recovery step when the user can fix it (cookie, permission, retry)
- [ ] Success names the thing that changed
- [ ] Catch blocks use `toastApiError` (or `getUserFacingError`)
- [ ] Backend 422 messages for sync/cookie are already human-readable

---

## 7. Anti-patterns

| Don't | Do |
|-------|----|
| `toast.error(err.message)` | `toastApiError(err, 'Failed to …')` |
| `toast.error(\`Error ${status}\`)` | Status fallback via helper |
| Show vendor API body in toast | Log server-side; friendly toast only |
| Toast-only confirm for delete | Use AlertDialog |
| Mix Sonner + Radix toaster | Sonner only |

---

## 8. Related

- DESIGN_TEMPLATE.md §18 — toaster chrome
- Marketplace Reviews sync / TikTok Shop & Shopee cookie flows — primary cookie-error surfaces
