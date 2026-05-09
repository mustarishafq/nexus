# Web Push Deployment & Testing Checklist

Complete guide for deploying web push notifications across local, staging, and production environments.

---

## **Table of Contents**

1. [Environment Setup](#1-environment-setup-production)
2. [Database & Migrations](#2-database--migrations)
3. [Frontend PWA Setup](#3-frontend-pwa-metadata)
4. [Service Worker Deployment](#4-service-worker)
5. [API Endpoints Verification](#5-api-endpoints-ready)
6. [HTTPS Requirement](#6-https-requirement)
7. [Local Testing](#phase-1-local-testing-localhost)
8. [Browser-Specific Testing](#phase-2-browser-specific-testing)
9. [Production Testing](#phase-3-production-testing)
10. [Device Testing Matrix](#phase-4-device-testing)
11. [Debugging Guide](#debugging-checklist)
12. [Monitoring & Alerts](#monitoring--alerts)

---

## **1. Environment Setup (Production)**

### **Generate VAPID Keys (One Time Only)**

VAPID (Voluntary Application Server Identification) keys identify your server to push services.

```bash
# Run locally or on production server
cd backend && php artisan tinker
```

In the tinker shell:
```php
use Minishlink\WebPush\VAPID;
$keys = VAPID::createVapidKeys();
echo "Public Key: " . $keys['publicKey'] . "\n";
echo "Private Key: " . $keys['privateKey'] . "\n";
exit();
```

**⚠️ Important:**
- Save these keys securely (e.g., password manager)
- Private key is **secret** — never commit to git or share
- Reuse the same keys across all environments
- Regenerate only if keys are compromised

### **Add to `.env` Files**

**Local `.env`:**
```env
WEB_PUSH_SUBJECT=mailto:your-email@domain.com
WEB_PUSH_PUBLIC_KEY=<your_generated_public_key>
WEB_PUSH_PRIVATE_KEY=<your_generated_private_key>
```

**Production `.env`:**
```env
WEB_PUSH_SUBJECT=mailto:production-email@domain.com
WEB_PUSH_PUBLIC_KEY=<same_public_key_as_local>
WEB_PUSH_PRIVATE_KEY=<same_private_key_as_local>
```

**Update `.env.example` (for documentation):**
```env
WEB_PUSH_SUBJECT=mailto:hello@example.com
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
```

### **Verify Configuration**

```bash
php artisan tinker
echo config('services.web_push.vapid_public_key');
echo config('services.web_push.vapid_private_key');
echo config('services.web_push.subject');
# Should all print values, not null
exit();
```

---

## **2. Database & Migrations**

### **Local Development**

```bash
cd backend
php artisan migrate
```

Creates two new tables:
- `app_settings` — stores system branding, SMTP config, etc.
- `push_subscriptions` — stores browser subscription endpoints

### **Production Deployment**

```bash
# Via SSH on production server
php artisan migrate --force
```

**Verify tables exist:**
```bash
php artisan tinker
DB::table('app_settings')->count();
DB::table('push_subscriptions')->count();
# Both should return 0 initially
exit();
```

---

## **3. Frontend PWA Metadata**

Verify [frontend/index.html](../frontend/index.html) includes:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Nexus" />
    <link rel="manifest" href="/api/pwa/manifest" />
    <link rel="apple-touch-icon" href="/icons/pwa-icon.svg" />
    <title>Nexus</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Required elements:**
- ✅ `<link rel="manifest" href="/api/pwa/manifest">`
- ✅ `<meta name="theme-color">`
- ✅ `<meta name="apple-mobile-web-app-capable">`

---

## **4. Service Worker**

### **File Location**
- Path: `frontend/public/sw.js`
- URL: `http://localhost:5173/sw.js` (local) or `https://your-domain.com/sw.js` (production)

### **Responsibilities**
1. **Cache Management**: Caches app shell (HTML, CSS, JS) for offline use
2. **Offline Fallback**: Serves offline.html when network unavailable
3. **Push Event Handling**: Receives push notifications and displays them
4. **Click Routing**: Opens/focuses correct page when notification clicked

### **Deployment Checklist**

- ✅ Service worker file deployed to `/public/` or CDN
- ✅ HTTPS enabled (except localhost)
- ✅ Scope set correctly: `navigator.serviceWorker.register('/sw.js')`
- ✅ No caching headers on `/sw.js` itself (always fetch fresh)

### **Verify Registration**

```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log("Active service workers:", regs);
});
```

Expected output:
```javascript
[ServiceWorkerRegistration {
  active: ServiceWorker { url: "https://your-domain.com/sw.js", ... },
  scope: "https://your-domain.com/",
  ...
}]
```

---

## **5. API Endpoints Ready**

These endpoints must be live and accessible:

### **Public Endpoints** (no auth required)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/app-settings/public` | GET | Return system name for branding |
| `/api/pwa/manifest` | GET | Return PWA manifest JSON |

### **Authenticated Endpoints** (require bearer token)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/push/subscribe` | POST | Register device subscription |
| `DELETE /api/push/subscriptions/{id}` | DELETE | Unsubscribe device |
| `GET /api/push/subscriptions` | GET | List user's subscriptions |
| `POST /api/notifications` | POST | Create notification (triggers push) |

### **Test Endpoints**

```bash
# Public endpoint
curl http://localhost:8000/api/app-settings/public

# Should return:
# {"system_name":"Nexus"}

# Authenticated endpoint (requires token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/push/subscriptions

# Should return:
# []  (empty array initially)
```

---

## **6. HTTPS Requirement**

⚠️ **Critical: Web Push only works over HTTPS (except localhost)**

### **Local Development**
- `http://localhost:5173` — ✅ Works (localhost exception)
- `http://127.0.0.1:5173` — ✅ Works (localhost exception)
- `http://192.168.1.100:5173` — ❌ Fails (not localhost)

### **Production**
- `https://your-domain.com` — ✅ Required
- `http://your-domain.com` — ❌ Fails

### **Getting HTTPS**

- **Free**: Let's Encrypt (certbot)
- **Paid**: DigiCert, Sectigo, etc.
- **Platform-specific**: Heroku, Vercel, Railway provide HTTPS by default

---

## **Phase 1: Local Testing (Localhost)**

### **Start Dev Servers**

```bash
# Terminal 1: Backend
cd backend && php artisan serve
# Server running on: http://127.0.0.1:8000

# Terminal 2: Frontend
cd frontend && npm run dev
# Server running on: http://localhost:5173
```

### **Test 1: Enable Push Notifications**

1. Open browser: `http://localhost:5173`
2. Navigate to **Settings** page
3. Scroll to "Push Notifications" section
4. Click **"Enable Push Notifications"**
5. Browser should prompt: "localhost wants to show notifications"
6. Click **"Allow"**
7. ✅ Should see message: "Push notifications enabled"

### **Test 2: Verify Service Worker Registration**

1. Open DevTools: `F12` or `Cmd+Option+I`
2. Go to **Application** tab
3. Left sidebar → **Service Workers**
4. ✅ Should see: `http://localhost:5173/sw.js` with status "activated and running"

### **Test 3: Verify Manifest**

1. In DevTools, go to **Application** → **Manifest**
2. Should show manifest with:
   ```json
   {
     "name": "Nexus",
     "short_name": "Nexus",
     "start_url": "/",
     "display": "standalone",
     "theme_color": "#ffffff",
     "background_color": "#ffffff",
     "icons": [...]
   }
   ```

### **Test 4: Verify Push Subscription**

1. In DevTools, go to **Application** → **Storage** → **IndexedDB**
2. Expand database entries to see subscription data
3. Or check database directly:

```bash
php artisan tinker
App\Models\PushSubscription::where('user_id', auth()->id())->first();
# Should show: endpoint, public_key, auth_token
exit();
```

### **Test 5: Send a Test Push (Closed Site)**

```bash
cd backend && php artisan tinker
```

```php
// Get current user (or any user)
$user = App\Models\User::first();

// Create a notification
$notification = $user->notifications()->create([
    'title' => 'Test Push',
    'message' => 'If you see this, web push works! 🎉',
    'type' => 'info',
    'priority' => 'high',
    'broadcast' => false,
]);

// Send push to their subscriptions
app(App\Services\PushNotificationService::class)->send($notification);

exit();
```

**Expected Result:**
- ✅ Notification appears in system tray (even with site closed)
- ✅ Click notification → browser opens and focuses correct page
- ✅ Check browser console for any errors

### **Test 6: Send Broadcast Push**

```php
php artisan tinker

// Send to ALL users
$notification = App\Models\Notification::create([
    'title' => 'System Broadcast',
    'message' => 'This goes to everyone!',
    'type' => 'success',
    'broadcast' => true,
]);

app(App\Services\PushNotificationService::class)->send($notification);

exit();
```

All users with active subscriptions should receive the notification.

---

## **Phase 2: Browser-Specific Testing**

Test web push across different browsers to ensure compatibility.

### **Chrome / Edge / Brave**

**Status:** ✅ **Full Support**

```
✅ Web Push notifications
✅ Works with site closed
✅ Notification click routing works
✅ PWA install available
```

**Testing Steps:**
1. Enable push (Settings page)
2. Close site completely
3. Send test push from backend
4. Verify notification appears in system tray
5. Click → app opens to correct page

### **Firefox**

**Status:** ✅ **Full Support**

```
✅ Web Push notifications
✅ Works with site closed
✅ Notification click routing works
✅ PWA support (limited on desktop)
```

**Testing Steps:** Same as Chrome

### **Safari (macOS)**

**Status:** ⚠️ **Limited Support**

```
❌ Web Push NOT available
⚠️ Notifications only if site is open
✅ PWA app mode available
```

**Note:** Safari doesn't implement the Web Push API. Notifications can still be sent via:
- Native push notifications (requires iOS app)
- In-app notifications (while tab is open)

**User-Facing Message:**
```javascript
if (
  !('serviceWorker' in navigator) || 
  !('PushManager' in window)
) {
  // Show: "Notifications not available in this browser"
}
```

### **Safari (iOS)**

**Status:** ❌ **No Web Push Support**

```
❌ Web Push NOT available
❌ No service worker support
✅ PWA can be added to homescreen
```

**Workaround:** 
- Let users add app to homescreen (full screen PWA)
- Send periodic in-app notifications instead

### **Chrome Android**

**Status:** ✅ **Full Support**

```
✅ Web Push notifications
✅ Works with app in background
✅ PWA can be installed
✅ Full native app experience
```

**Testing Steps:**
1. Open `http://localhost:5173` on Android device
2. Tap menu → "Install app" or "Add to homescreen"
3. Enable push notifications
4. Minimize/close app
5. Send test push
6. ✅ Notification should appear

### **Samsung Internet**

**Status:** ✅ **Full Support**

Same as Chrome Android.

### **Summary Table**

| Browser | Web Push | Offline | PWA | Notes |
|---------|----------|---------|-----|-------|
| Chrome Desktop | ✅ Yes | ✅ Yes | ✅ Yes | Full support |
| Firefox Desktop | ✅ Yes | ✅ Yes | ✅ Yes | Full support |
| Edge Desktop | ✅ Yes | ✅ Yes | ✅ Yes | Chromium-based |
| Safari macOS | ❌ No | ❌ No | ⚠️ Limited | Not implemented |
| Safari iOS | ❌ No | ❌ No | ⚠️ Homescreen only | Not implemented |
| Chrome Android | ✅ Yes | ✅ Yes | ✅ Yes | Full support |
| Firefox Android | ✅ Yes | ✅ Yes | ✅ Yes | Full support |
| Samsung Internet | ✅ Yes | ✅ Yes | ✅ Yes | Chromium-based |

---

## **Phase 3: Production Testing**

### **Pre-Deployment Checklist**

- ✅ VAPID keys configured in production `.env`
- ✅ Database migrated (`php artisan migrate --force`)
- ✅ Service worker deployed to `/public/sw.js`
- ✅ HTTPS enabled and working
- ✅ API endpoints accessible
- ✅ Logs monitored

### **Step 1: Health Check**

```bash
# Check public endpoints are live
curl https://your-domain.com/api/app-settings/public

# Expected response:
# {"system_name":"Your App Name"}
```

### **Step 2: Subscribe Flow**

1. Open `https://your-domain.com` in browser
2. Navigate to **Settings**
3. Click **"Enable Push Notifications"**
4. Allow browser permission
5. Refresh page
6. ✅ Should show "Push notifications enabled"
7. Check database:

```bash
php artisan tinker
App\Models\PushSubscription::count();
# Should be 1 (or more if multiple devices)
exit();
```

### **Step 3: Send Push to Specific User**

```bash
php artisan tinker
```

```php
// Find target user
$user = App\Models\User::find(1);

// Create notification
$notification = $user->notifications()->create([
    'title' => 'Production Test',
    'message' => 'Testing web push on production',
    'type' => 'info',
    'priority' => 'high',
    'broadcast' => false,
]);

// Send push
app(App\Services\PushNotificationService::class)->send($notification);

exit();
```

**Expected Result:**
- ✅ Notification arrives on user's device (even if site closed)
- ✅ Click opens app
- ✅ Check `storage/logs/laravel.log` for success message

### **Step 4: Broadcast to All Users**

```php
php artisan tinker

$notification = App\Models\Notification::create([
    'title' => 'System Announcement',
    'message' => 'Important update: Maintenance completed',
    'type' => 'success',
    'broadcast' => true,
]);

app(App\Services\PushNotificationService::class)->send($notification);

exit();
```

All users with active subscriptions receive it simultaneously.

### **Step 5: Test from UI**

1. Log in as admin
2. Navigate to **Broadcast Center**
3. Create a new broadcast
4. Select recipients (or broadcast to all)
5. Click **Send**
6. ✅ All targeted users receive notification

---

## **Phase 4: Device Testing**

Test across multiple physical devices to ensure real-world compatibility.

### **Test Matrix**

| Device | Browser | Push | Offline | PWA | Status |
|--------|---------|------|---------|-----|--------|
| Laptop | Chrome | ✅ | ✅ | ✅ | Test |
| Laptop | Firefox | ✅ | ✅ | ✅ | Test |
| Laptop | Safari | ❌ | ❌ | ⚠️ | Document limitation |
| Phone (Android) | Chrome | ✅ | ✅ | ✅ | Test |
| Phone (Android) | Firefox | ✅ | ✅ | ✅ | Test |
| Phone (iOS) | Safari | ❌ | ❌ | ⚠️ | Document limitation |
| Tablet (Android) | Chrome | ✅ | ✅ | ✅ | Test |
| Tablet (iPad) | Safari | ❌ | ❌ | ⚠️ | Document limitation |

### **Testing Procedure for Each Device**

1. **Subscribe**
   - Open app on device
   - Enable push notifications
   - Allow permission
   - Verify subscription in DB

2. **Offline Test**
   - Minimize/close app
   - Turn off WiFi/mobile data
   - Send push notification
   - ✅ Should still be queued/delivered when back online

3. **Click Routing**
   - Send push with specific notification type
   - Click notification
   - ✅ App opens and shows correct page

4. **Performance**
   - Send multiple pushes in quick succession
   - Monitor app performance
   - Check for memory leaks

---

## **Debugging Checklist**

### **Push Notifications Not Arriving?**

#### **Issue 1: VAPID Keys Not Set**

```bash
php artisan tinker
echo config('services.web_push.vapid_public_key');
```

**Solution:**
- If null: Add keys to `.env`
- Restart Laravel server: `php artisan serve` or `systemctl restart laravel`

#### **Issue 2: No Subscriptions in Database**

```bash
php artisan tinker
App\Models\PushSubscription::count();
# If 0, users haven't subscribed yet
exit();
```

**Solution:**
1. Ensure user completes settings page flow
2. Browser permission must be "Allow"
3. Check browser console for JS errors

#### **Issue 3: Invalid Subscription Endpoint**

Endpoints expire or change. Check logs:

```bash
tail -f storage/logs/laravel.log | grep "push"
```

Look for 404/410 responses. These subscriptions are automatically deleted.

#### **Issue 4: Service Worker Not Registered**

In browser console:
```javascript
navigator.serviceWorker.getRegistrations()
```

If empty:
- Check `/public/sw.js` exists
- Check HTTPS (if not localhost)
- Check browser console for registration errors

### **Subscription Stuck on "Subscribing..."?**

1. Open **DevTools → Network**
2. Watch `POST /api/push/subscribe`
3. Check response:
   - 200 OK → Check for JS error in console
   - 401 → Auth token expired
   - 500 → Server error, check logs

```bash
tail -f storage/logs/laravel.log
```

### **Notification Click Not Opening App?**

1. Check service worker `notificationclick` handler:

```javascript
// In sw.js
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Should find and focus existing window
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Or open new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
```

2. Check browser console for JS errors
3. Verify notification data includes correct route

### **"Push not supported" Message Shows**

Browser doesn't support Web Push.

```bash
# Check in DevTools console:
'serviceWorker' in navigator  // false = need to handle
'PushManager' in window        // false = web push not supported
```

**Solution:** Show degraded UI or suggest native app

### **CORS Errors When Sending to Push Service**

If logs show CORS errors:

```
Access to XMLHttpRequest at 'https://fcm.googleapis.com/...' 
from origin 'http://localhost:8000' has been blocked by CORS policy
```

**Solution:**
- Server-to-server requests don't have CORS issues
- This shouldn't happen in normal operation
- If it does, check firewall/proxy settings

### **Memory Leak in Service Worker**

Monitor app after sending many pushes:

```javascript
// In DevTools → Memory tab
// Watch memory usage grow
// Check for unclosed listeners/timers
```

**Solution:** Check service worker for:
- Unreleased event listeners
- Unclosed database connections
- Lingering timers

---

## **Monitoring & Alerts**

### **What to Monitor**

#### **1. Push Send Success Rate**

```bash
# Check logs daily
grep "Push notification sent" storage/logs/laravel.log | wc -l
```

Track:
- Total sent
- Failed (404/410 responses)
- Success rate percentage

#### **2. Expired Subscriptions**

```php
php artisan tinker
App\Models\PushSubscription::where('updated_at', '<', now()->subDays(30))->count();
# Subscriptions inactive for 30+ days
exit();
```

#### **3. Error Rate**

```bash
grep "ERROR" storage/logs/laravel.log | grep -i push | wc -l
```

Alert if:
- Error rate > 5%
- More than 10 errors in 1 hour
- VAPID configuration errors

#### **4. Performance**

Track:
- Push send latency (target: < 5 seconds)
- Service worker registration time
- Notification display time

### **Setting Up Alerts**

#### **For Heroku**

```bash
# Check error rate
heroku logs --tail | grep ERROR
```

#### **For Docker**

```bash
# Monitor container logs
docker logs --follow container-name | grep push
```

#### **For Linux/Systemd**

```bash
# Journal logs
journalctl -u laravel -f | grep push
```

#### **Custom Alert Script**

```php
// app/Console/Commands/CheckPushHealth.php
php artisan make:command CheckPushHealth

// Check push system health
// Alert if issues detected
```

Schedule via cron:
```bash
* * * * * php artisan schedule:run
```

### **Metrics to Export**

```php
// Log structured metrics
Log::info('push_metrics', [
    'sent' => 100,
    'failed' => 2,
    'success_rate' => 0.98,
    'avg_latency_ms' => 1250,
]);
```

Parse with tools like:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Datadog**
- **New Relic**
- **CloudWatch** (AWS)

---

## **Quick Reference**

### **Common Commands**

```bash
# Generate VAPID keys
php artisan tinker
use Minishlink\WebPush\VAPID;
$keys = VAPID::createVapidKeys();

# Run migrations
php artisan migrate

# Send test push
php artisan tinker
$user = App\Models\User::first();
$notification = $user->notifications()->create([
    'title' => 'Test',
    'message' => 'Test message',
    'type' => 'info',
    'broadcast' => false,
]);
app(App\Services\PushNotificationService::class)->send($notification);

# Check subscriptions
php artisan tinker
App\Models\PushSubscription::count();
App\Models\PushSubscription::where('user_id', 1)->first();

# Clear old subscriptions
php artisan tinker
App\Models\PushSubscription::where('updated_at', '<', now()->subDays(60))->delete();

# View logs
tail -f storage/logs/laravel.log

# Test API endpoint
curl http://localhost:8000/api/app-settings/public
```

### **Troubleshooting Flowchart**

```
Push not arriving?
├─ Yes, service worker shows error
│  └─ Check /public/sw.js exists
│
├─ Yes, "Push not supported" message
│  └─ Browser doesn't support Web Push (Safari, old browsers)
│
├─ Yes, subscription is "subscribing..." forever
│  └─ Check POST /api/push/subscribe response in Network tab
│
├─ Yes, push sent but notification never appears
│  ├─ Check logs for 404/410 errors (expired endpoint)
│  ├─ Check VAPID keys in .env
│  └─ Check browser notification settings
│
├─ Yes, notification appears but click does nothing
│  └─ Check service worker notificationclick event handler
│
└─ No issues, everything works!
   └─ Monitor performance and error rates
```

---

## **Support & Resources**

- **Web Push API:** https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- **Service Workers:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **minishlink/web-push:** https://github.com/web-push-libs/web-push-php
- **VAPID Specification:** https://tools.ietf.org/html/draft-thomson-webpush-vapid
- **Browser Support:** https://caniuse.com/push-api

---

**Document Version:** 1.0  
**Last Updated:** May 9, 2026  
**Author:** Nexus Development Team
