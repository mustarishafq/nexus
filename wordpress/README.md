# WordPress SSO for Nexus

This directory contains a **must-use plugin** that lets WordPress accept auto-login
from [EMZI Nexus](../SSO_INTEGRATION_GUIDE.md) via signed JWT tokens.

**Requires PHP 7.4+** (matches WordPress 5.9+). PHP 8.1+ is recommended when available.

> **Important:** Configuring the application in Nexus is only half the setup. WordPress
> must also be told the shared API key. Nexus signs tokens with the key; WordPress
> verifies them with the same key. If you see `NEXUS_API_KEY is not configured`, the
> WordPress side is missing — not Nexus.

## Install

1. Copy the plugin into WordPress:

   ```bash
   cp -R wordpress/mu-plugins/nexus-sso.php /path/to/wp-content/mu-plugins/
   cp -R wordpress/nexus-sso /path/to/wp-content/mu-plugins/
   ```

2. Install the JWT library (run on the WordPress server, or with PHP 7.4 locally):

   ```bash
   cd /path/to/wp-content/mu-plugins/nexus-sso
   composer install --no-dev --no-security-blocking
   ```

   If Composer reports a PHP version mismatch, ensure `composer.json` requires `>=7.4`
   and re-run the command on a machine matching your WordPress PHP version.

3. **Configure the shared API key on WordPress** (must match Nexus Applications → API Key):

   **Option A — config file (easiest):**

   ```bash
   cd /path/to/wp-content/mu-plugins/nexus-sso
   cp config.example.php config.php
   # Edit config.php and paste your Nexus application API Key
   ```

   **Option B — wp-config.php** (above `/* That's all, stop editing! */`):

   ```php
   define('NEXUS_API_KEY', 'your-shared-secret-min-32-chars');
   define('NEXUS_ISSUER', 'https://nexus.example.com'); // Nexus APP_URL
   define('NEXUS_AUTO_PROVISION', true);                  // create WP users on first login
   define('NEXUS_DEFAULT_ROLE', 'administrator');         // role for new users
   define('NEXUS_LOGIN_REDIRECT', 'admin');               // admin | home | /custom-path
   define('NEXUS_RETURN_TO', 'https://nexus.example.com/applications'); // logout fallback
   ```

   Generate a key (use the same value in Nexus and WordPress):

   ```bash
   openssl rand -hex 32
   ```

4. Flush permalinks: **Settings → Permalinks → Save Changes**

5. Verify the endpoint resolves (should not 404):

   ```
   https://your-wp-site.com/sso/nexus
   ```

## Configure Nexus

In **Applications → Add/Edit**:

| Field | Value |
|---|---|
| Name | e.g. Company WordPress |
| Base URL | `https://your-wp-site.com` (no trailing slash) |
| Application Type | **JWT SSO** |
| API Key | Same value as `NEXUS_API_KEY` in wp-config.php |
| Enabled | On |

Optional seeder (local/dev): set these in the Nexus backend `.env` and run `php artisan db:seed`:

```env
WORDPRESS_BASE_URL=https://your-wp-site.com
WORDPRESS_API_KEY=your-shared-secret-min-32-chars
```

## User mapping

| Setting | Behavior |
|---|---|
| `NEXUS_AUTO_PROVISION=true` (default) | Creates a WordPress user on first SSO login |
| `NEXUS_AUTO_PROVISION=false` | Rejects login if no matching email exists in WordPress |
| `NEXUS_DEFAULT_ROLE` | Role assigned to auto-provisioned users (default: `administrator`) |

Auto-provisioned users receive a random password so they cannot log in via the normal WordPress login form.

## Logout redirect

After SSO login, the plugin stores Nexus `return_to` in user meta. When the user logs out of WordPress, they are redirected back to Nexus (typically `/applications`).

## End-to-end test

1. Ensure your Nexus user email matches an existing WordPress user (or enable auto-provision).
2. In Nexus, open **Applications** and click **Launch** on the WordPress app.
3. Browser navigates to `https://your-wp-site.com/sso/nexus?token=...`.
4. You should land in WP admin without entering credentials.
5. Log out of WordPress — you should return to Nexus.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `NEXUS_API_KEY is not configured` | WordPress needs the key too — copy `config.example.php` to `config.php` or add `define('NEXUS_API_KEY', '...')` to wp-config.php (same value as Nexus) |
| Composer requires PHP >= 8.1 | Delete `vendor/` and `composer.lock`, pull latest plugin, run `composer install --no-dev --no-security-blocking` on PHP 7.4 |
| Critical error / platform issues | Reinstall deps with PHP 7.4: `composer install --no-dev --no-security-blocking` |
| 404 on `/sso/nexus` | Save Permalinks in WP admin |
| JWT library not installed | Run `composer install` in `mu-plugins/nexus-sso` |
| Invalid SSO token | Ensure `NEXUS_API_KEY` matches Nexus Application API Key |
| Invalid token issuer | Set `NEXUS_ISSUER` to your Nexus `APP_URL` |
| Logout goes to wp-login.php?reauth=1 | Update plugin to v1.0.3+ and set `NEXUS_RETURN_TO` / `NEXUS_ISSUER` in config.php (WordPress blocks external logout redirects by default) |
| No WordPress account exists | Enable `NEXUS_AUTO_PROVISION` or create the user manually |

See also: [SSO_INTEGRATION_GUIDE.md](../SSO_INTEGRATION_GUIDE.md)
