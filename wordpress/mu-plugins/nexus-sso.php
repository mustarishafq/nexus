<?php
/**
 * Plugin Name: Nexus SSO
 * Description: Auto-login from EMZI Nexus via signed JWT tokens.
 * Version: 1.0.0
 *
 * Copy this file and the nexus-sso/ directory into wp-content/mu-plugins/.
 */

if (! defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/nexus-sso/plugin.php';
