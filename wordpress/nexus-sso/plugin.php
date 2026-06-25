<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

define('NEXUS_SSO_VERSION', '1.0.3');

$configFile = __DIR__ . '/config.php';
if (is_readable($configFile)) {
    require_once $configFile;
}

/**
 * Shared secret — must match the API Key configured on the Nexus application.
 * Set in wp-config.php, config.php, or the NEXUS_API_KEY server env var.
 */
if (! defined('NEXUS_API_KEY')) {
    define('NEXUS_API_KEY', getenv('NEXUS_API_KEY') ?: '');
}

/**
 * Expected JWT issuer (iss claim) — your Nexus APP_URL.
 * Example: define('NEXUS_ISSUER', 'https://nexus.example.com');
 */
if (! defined('NEXUS_ISSUER')) {
    define('NEXUS_ISSUER', getenv('NEXUS_ISSUER') ?: '');
}

/**
 * When true, create a WordPress user on first SSO login if email is unknown.
 * When false, reject login for emails that do not already exist in WordPress.
 */
if (! defined('NEXUS_AUTO_PROVISION')) {
    define('NEXUS_AUTO_PROVISION', filter_var(getenv('NEXUS_AUTO_PROVISION') ?: 'true', FILTER_VALIDATE_BOOLEAN));
}

/**
 * Default role assigned to auto-provisioned users (administrator, editor, subscriber, etc.).
 */
if (! defined('NEXUS_DEFAULT_ROLE')) {
    define('NEXUS_DEFAULT_ROLE', getenv('NEXUS_DEFAULT_ROLE') ?: 'administrator');
}

/**
 * Where to send the user after a successful SSO login.
 */
if (! defined('NEXUS_LOGIN_REDIRECT')) {
    define('NEXUS_LOGIN_REDIRECT', getenv('NEXUS_LOGIN_REDIRECT') ?: 'admin');
}

/**
 * Fallback URL when logging out of WordPress (if return_to was not stored on SSO login).
 * Usually your Nexus /applications page, e.g. https://nexus.example.com/applications
 */
if (! defined('NEXUS_RETURN_TO')) {
    define('NEXUS_RETURN_TO', getenv('NEXUS_RETURN_TO') ?: '');
}

$autoload = __DIR__ . '/vendor/autoload.php';
if (is_readable($autoload)) {
    require_once $autoload;
}

final class Nexus_Sso
{
    private const QUERY_VAR = 'nexus_sso';
    private const RETURN_TO_META_KEY = 'nexus_return_to';

    public static function boot(): void
    {
        add_action('init', [self::class, 'register_rewrite_rules']);
        add_action('template_redirect', [self::class, 'handle_sso_request']);
        add_filter('logout_redirect', [self::class, 'logout_redirect'], 10, 3);
        add_filter('allowed_redirect_hosts', [self::class, 'allowed_redirect_hosts']);
    }

    public static function register_rewrite_rules(): void
    {
        add_rewrite_tag('%' . self::QUERY_VAR . '%', '1');
        add_rewrite_rule('^sso/nexus/?$', 'index.php?' . self::QUERY_VAR . '=1', 'top');

        $flushedVersion = get_option('nexus_sso_rewrite_version');
        if ($flushedVersion !== NEXUS_SSO_VERSION) {
            flush_rewrite_rules(false);
            update_option('nexus_sso_rewrite_version', NEXUS_SSO_VERSION, true);
        }
    }

    public static function handle_sso_request(): void
    {
        if (! get_query_var(self::QUERY_VAR)) {
            return;
        }

        if (! class_exists(\Firebase\JWT\JWT::class)) {
            self::fail('JWT library not installed. Run composer install in wp-content/mu-plugins/nexus-sso.', 500);
        }

        if (NEXUS_API_KEY === '') {
            self::fail(
                'NEXUS_API_KEY is not configured on WordPress. '
                . 'Copy config.example.php to config.php in wp-content/mu-plugins/nexus-sso/ '
                . 'and set the same API Key as your Nexus application, '
                . 'or add define(\'NEXUS_API_KEY\', \'...\') to wp-config.php.',
                500
            );
        }

        $token = isset($_GET['token']) ? sanitize_text_field(wp_unslash((string) $_GET['token'])) : '';
        if ($token === '') {
            self::fail('Missing SSO token.', 400);
        }

        try {
            $payload = \Firebase\JWT\JWT::decode(
                $token,
                new \Firebase\JWT\Key(NEXUS_API_KEY, 'HS256')
            );
        } catch (\Throwable $exception) {
            self::fail('Invalid SSO token.', 401);
        }

        $claims = (array) $payload;

        if (! self::validate_issuer($claims)) {
            self::fail('Invalid token issuer.', 401);
        }

        $email = isset($claims['email']) ? sanitize_email((string) $claims['email']) : '';
        if ($email === '' || ! is_email($email)) {
            self::fail('Token is missing a valid email claim.', 401);
        }

        $user = get_user_by('email', $email);
        if (! $user) {
            if (! NEXUS_AUTO_PROVISION) {
                self::fail('No WordPress account exists for this email.', 403);
            }

            $user = self::provision_user($email, $claims);
            if (! $user instanceof \WP_User) {
                self::fail('Unable to provision WordPress user.', 500);
            }
        }

        wp_clear_auth_cookie();
        wp_set_current_user($user->ID);
        wp_set_auth_cookie($user->ID, true, is_ssl());
        do_action('wp_login', $user->user_login, $user);

        $returnTo = self::resolve_return_to($claims);
        if ($returnTo !== '') {
            update_user_meta($user->ID, self::RETURN_TO_META_KEY, $returnTo);
        }

        $postLoginUrl = self::resolve_post_login_redirect($claims);
        wp_safe_redirect($postLoginUrl !== '' ? $postLoginUrl : self::login_redirect_url());
        exit;
    }

    public static function logout_redirect($redirect, $requestedRedirectTo, $user)
    {
        unset($redirect, $requestedRedirectTo);

        if (! $user instanceof \WP_User) {
            return self::default_return_to();
        }

        $returnTo = get_user_meta($user->ID, self::RETURN_TO_META_KEY, true);
        if (is_string($returnTo) && $returnTo !== '') {
            return $returnTo;
        }

        return self::default_return_to();
    }

    /**
     * WordPress wp_safe_redirect() blocks external hosts unless they are allowlisted.
     *
     * @param array<int, string> $hosts
     * @return array<int, string>
     */
    public static function allowed_redirect_hosts(array $hosts): array
    {
        foreach (self::collect_return_to_urls() as $url) {
            $host = wp_parse_url($url, PHP_URL_HOST);
            if (is_string($host) && $host !== '') {
                $hosts[] = $host;
            }
        }

        return array_values(array_unique($hosts));
    }

    private static function default_return_to(): string
    {
        if (defined('NEXUS_RETURN_TO') && NEXUS_RETURN_TO !== '') {
            return NEXUS_RETURN_TO;
        }

        if (NEXUS_ISSUER !== '') {
            return rtrim(NEXUS_ISSUER, '/') . '/applications';
        }

        return wp_login_url();
    }

    /**
     * @return array<int, string>
     */
    private static function collect_return_to_urls(): array
    {
        $urls = [];

        if (defined('NEXUS_RETURN_TO') && NEXUS_RETURN_TO !== '') {
            $urls[] = NEXUS_RETURN_TO;
        }

        if (NEXUS_ISSUER !== '') {
            $urls[] = rtrim(NEXUS_ISSUER, '/') . '/applications';
            $urls[] = NEXUS_ISSUER;
        }

        return $urls;
    }

    private static function validate_issuer(array $claims): bool
    {
        $issuer = isset($claims['iss']) ? rtrim((string) $claims['iss'], '/') : '';
        if ($issuer === '') {
            return false;
        }

        if (NEXUS_ISSUER !== '') {
            return hash_equals(rtrim(NEXUS_ISSUER, '/'), $issuer);
        }

        return true;
    }

    private static function resolve_return_to(array $claims): string
    {
        if (! empty($_GET['return_to'])) {
            return esc_url_raw(wp_unslash((string) $_GET['return_to']));
        }

        if (! empty($claims['return_to'])) {
            return esc_url_raw((string) $claims['return_to']);
        }

        return '';
    }

    private static function provision_user(string $email, array $claims): ?\WP_User
    {
        $username = self::unique_username($email, $claims);
        $password = wp_generate_password(32, true, true);
        $userId = wp_create_user($username, $password, $email);

        if (is_wp_error($userId)) {
            return null;
        }

        $role = sanitize_key(NEXUS_DEFAULT_ROLE);
        if ($role !== '' && get_role($role) instanceof \WP_Role) {
            $user = get_user_by('id', $userId);
            if ($user instanceof \WP_User) {
                $user->set_role($role);
            }
        }

        self::sync_display_name(get_user_by('id', $userId), $claims);

        return get_user_by('id', $userId) ?: null;
    }

    private static function unique_username(string $email, array $claims): string
    {
        $localPart = sanitize_user(strstr($email, '@', true) ?: $email, true);
        $base = $localPart !== '' ? $localPart : 'nexus-user';
        $candidate = $base;
        $suffix = 1;

        while (username_exists($candidate)) {
            $candidate = $base . '-' . $suffix;
            $suffix++;
        }

        if ($candidate === '') {
            $name = isset($claims['name']) ? sanitize_user((string) $claims['name'], true) : '';
            $candidate = $name !== '' ? $name : 'nexus-user-' . wp_generate_password(6, false, false);
        }

        return $candidate;
    }

    private static function sync_display_name(?\WP_User $user, array $claims): void
    {
        if (! $user instanceof \WP_User) {
            return;
        }

        $name = isset($claims['name']) ? sanitize_text_field((string) $claims['name']) : '';
        if ($name === '') {
            return;
        }

        wp_update_user([
            'ID' => $user->ID,
            'display_name' => $name,
        ]);
    }

    private static function resolve_post_login_redirect(array $claims = []): string
    {
        $redirectTo = '';

        if (! empty($_GET['redirect_to'])) {
            $redirectTo = wp_unslash((string) $_GET['redirect_to']);
        } elseif (! empty($claims['redirect_to'])) {
            $redirectTo = (string) $claims['redirect_to'];
        }

        return self::normalize_redirect_url($redirectTo);
    }

    private static function normalize_redirect_url(string $redirectTo): string
    {
        $redirectTo = trim($redirectTo);
        if ($redirectTo === '') {
            return '';
        }

        if (str_starts_with($redirectTo, '/') && ! str_starts_with($redirectTo, '//')) {
            $redirectTo = home_url($redirectTo);
        }

        $redirectTo = esc_url_raw($redirectTo);
        if ($redirectTo === '') {
            return '';
        }

        if (! self::is_same_site_url($redirectTo)) {
            return '';
        }

        return $redirectTo;
    }

    private static function is_same_site_url(string $url): bool
    {
        $targetHost = wp_parse_url($url, PHP_URL_HOST);
        $siteHost = wp_parse_url(home_url('/'), PHP_URL_HOST);

        if (! is_string($targetHost) || $targetHost === '' || ! is_string($siteHost) || $siteHost === '') {
            return false;
        }

        return strcasecmp($targetHost, $siteHost) === 0;
    }

    private static function login_redirect_url(): string
    {
        $target = NEXUS_LOGIN_REDIRECT;

        if ($target === 'admin') {
            return admin_url();
        }

        if ($target === 'home') {
            return home_url('/');
        }

        if (filter_var($target, FILTER_VALIDATE_URL)) {
            return esc_url_raw($target);
        }

        $path = '/' . ltrim($target, '/');

        return home_url($path);
    }

    private static function fail(string $message, int $status): void
    {
        wp_die(
            esc_html($message),
            esc_html__('Unauthorized', 'nexus-sso'),
            ['response' => $status]
        );
    }
}

Nexus_Sso::boot();
