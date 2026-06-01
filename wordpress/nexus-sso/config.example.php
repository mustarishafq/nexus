<?php

/**
 * Nexus SSO configuration for WordPress.
 *
 * 1. Copy this file to config.php in the same directory.
 * 2. Set NEXUS_API_KEY to the exact same value as the API Key on your Nexus application.
 * 3. Set NEXUS_ISSUER to your Nexus site URL (APP_URL), e.g. https://nexus.example.com
 *
 * Do not commit config.php — it contains secrets.
 */

if (! defined('NEXUS_API_KEY')) {
    define('NEXUS_API_KEY', 'paste-the-same-api-key-from-nexus-applications-here');
}

if (! defined('NEXUS_ISSUER')) {
    define('NEXUS_ISSUER', 'https://nexus.example.com');
}

if (! defined('NEXUS_AUTO_PROVISION')) {
    define('NEXUS_AUTO_PROVISION', true);
}

if (! defined('NEXUS_DEFAULT_ROLE')) {
    define('NEXUS_DEFAULT_ROLE', 'administrator');
}

if (! defined('NEXUS_LOGIN_REDIRECT')) {
    define('NEXUS_LOGIN_REDIRECT', 'admin');
}

if (! defined('NEXUS_RETURN_TO')) {
    define('NEXUS_RETURN_TO', 'https://nexus.example.com/applications');
}
