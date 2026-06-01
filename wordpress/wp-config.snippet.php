<?php

/**
 * Add these constants to wp-config.php (above "That's all, stop editing!").
 *
 * NEXUS_API_KEY must match the API Key on the WordPress application in Nexus.
 * NEXUS_ISSUER must match the Nexus APP_URL (iss claim on JWT tokens).
 */

define('NEXUS_API_KEY', 'replace-with-openssl-rand-hex-32');
define('NEXUS_ISSUER', 'https://nexus.example.com');
define('NEXUS_AUTO_PROVISION', true);
define('NEXUS_DEFAULT_ROLE', 'administrator');
define('NEXUS_LOGIN_REDIRECT', 'admin');
define('NEXUS_RETURN_TO', 'https://nexus.example.com/applications');
