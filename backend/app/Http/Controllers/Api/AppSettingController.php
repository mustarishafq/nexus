<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Support\ApiTokenAuth;
use App\Support\ApplicationLaunchSettings;
use App\Support\AppSettings;
use App\Support\AttendanceWatermarkSettings;
use App\Support\FeedModerationSettings;
use App\Support\SplashAnimationSettings;
use App\Support\UserRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AppSettingController extends Controller
{
    use AuthorizesRoles;

    public function publicShow(): JsonResponse
    {
        return response()->json($this->publicPayload());
    }

    public function show(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (UserRoles::isHr($user) && ! UserRoles::isAdmin($user)) {
            return response()->json($this->hrAttendancePayload());
        }

        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        return response()->json($this->adminPayload());
    }

    public function update(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (UserRoles::isHr($user) && ! UserRoles::isAdmin($user)) {
            return $this->updateHrSettings($request);
        }

        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate(array_merge([
            'system_name' => ['required', 'string', 'max:255'],
            'smtp_host' => ['nullable', 'string', 'max:255'],
            'smtp_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'smtp_username' => ['nullable', 'string', 'max:255'],
            'smtp_password' => ['nullable', 'string', 'max:2048'],
            'smtp_encryption' => ['nullable', 'in:tls,ssl,null'],
            'smtp_from_email' => ['nullable', 'email', 'max:255'],
            'smtp_from_name' => ['nullable', 'string', 'max:255'],
            'imap_host' => ['nullable', 'string', 'max:255'],
            'imap_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'imap_encryption' => ['nullable', 'in:ssl,tls,null'],
            'splash_animation_style' => ['nullable', 'string', 'in:'.implode(',', SplashAnimationSettings::allowedValues())],
        ], SplashAnimationSettings::validationRules(), ApplicationLaunchSettings::validationRules(), AttendanceWatermarkSettings::validationRules(), FeedModerationSettings::validationRules()));

        $current = (array) DB::table('app_settings')->first();
        $splash = SplashAnimationSettings::normalizeConfig(array_merge($current, $validated));
        $launch = ApplicationLaunchSettings::normalizeConfig(array_merge($current, $validated));
        $attendance = AttendanceWatermarkSettings::normalizeConfig(array_merge($current, $validated));
        $feed = self::resolveFeedModerationColumns($current, $validated);

        $settings = DB::table('app_settings')->first();

        if ($settings) {
            DB::table('app_settings')->where('id', $settings->id)->update(array_merge([
                'system_name' => $validated['system_name'],
                'smtp_host' => $validated['smtp_host'] ?? null,
                'smtp_port' => $validated['smtp_port'] ?? null,
                'smtp_username' => $validated['smtp_username'] ?? null,
                'smtp_password' => $validated['smtp_password'] ?? null,
                'smtp_encryption' => $validated['smtp_encryption'] === 'null' ? null : ($validated['smtp_encryption'] ?? null),
                'smtp_from_email' => $validated['smtp_from_email'] ?? null,
                'smtp_from_name' => $validated['smtp_from_name'] ?? null,
                'imap_host' => $validated['imap_host'] ?? null,
                'imap_port' => $validated['imap_port'] ?? null,
                'imap_encryption' => $validated['imap_encryption'] === 'null' ? null : ($validated['imap_encryption'] ?? null),
                'updated_at' => now(),
            ], SplashAnimationSettings::toDatabaseColumns($splash), ApplicationLaunchSettings::toDatabaseColumns($launch), AttendanceWatermarkSettings::toDatabaseColumns($attendance), $feed));
        } else {
            DB::table('app_settings')->insert(array_merge([
                'system_name' => $validated['system_name'],
                'smtp_host' => $validated['smtp_host'] ?? null,
                'smtp_port' => $validated['smtp_port'] ?? null,
                'smtp_username' => $validated['smtp_username'] ?? null,
                'smtp_password' => $validated['smtp_password'] ?? null,
                'smtp_encryption' => $validated['smtp_encryption'] === 'null' ? null : ($validated['smtp_encryption'] ?? null),
                'smtp_from_email' => $validated['smtp_from_email'] ?? null,
                'smtp_from_name' => $validated['smtp_from_name'] ?? null,
                'imap_host' => $validated['imap_host'] ?? null,
                'imap_port' => $validated['imap_port'] ?? null,
                'imap_encryption' => $validated['imap_encryption'] === 'null' ? null : ($validated['imap_encryption'] ?? null),
                'created_at' => now(),
                'updated_at' => now(),
            ], SplashAnimationSettings::toDatabaseColumns($splash), ApplicationLaunchSettings::toDatabaseColumns($launch), AttendanceWatermarkSettings::toDatabaseColumns($attendance), $feed));
        }

        AppSettings::forget();

        return response()->json($this->adminPayload());
    }

    private function updateHrSettings(Request $request): JsonResponse
    {
        $validated = $request->validate(array_merge(
            AttendanceWatermarkSettings::validationRules(),
            FeedModerationSettings::validationRules(),
        ));

        $current = (array) $this->currentSettings();
        $updates = ['updated_at' => now()];

        $hasAttendanceKeys = collect($validated)->keys()->contains(
            fn (string $key) => str_starts_with($key, 'attendance_')
        );

        if ($hasAttendanceKeys) {
            $attendance = AttendanceWatermarkSettings::normalizeConfig(array_merge($current, $validated));
            $updates = array_merge($updates, AttendanceWatermarkSettings::toDatabaseColumns($attendance));
        }

        $hasFeedKeys = array_key_exists('feed_posts_require_approval', $validated)
            || array_key_exists('feed_post_approval_exempt_user_ids', $validated);

        if ($hasFeedKeys) {
            $updates = array_merge($updates, self::resolveFeedModerationColumns($current, $validated));
        }

        $settings = DB::table('app_settings')->first();

        if ($settings) {
            DB::table('app_settings')->where('id', $settings->id)->update($updates);
        } else {
            DB::table('app_settings')->insert(array_merge([
                'system_name' => config('app.name', 'EMZI Nexus Brain'),
                'created_at' => now(),
                'updated_at' => now(),
            ], array_diff_key($updates, ['updated_at' => true])));
        }

        AppSettings::forget();

        return response()->json($this->hrSettingsPayload());
    }

    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $validated
     * @return array{feed_posts_require_approval: bool, feed_post_approval_exempt_user_ids: string}
     */
    private static function resolveFeedModerationColumns(array $current, array $validated): array
    {
        $requireApproval = array_key_exists('feed_posts_require_approval', $validated)
            ? (bool) $validated['feed_posts_require_approval']
            : FeedModerationSettings::requireApproval((object) $current);

        $exemptUserIds = array_key_exists('feed_post_approval_exempt_user_ids', $validated)
            ? FeedModerationSettings::normalizeExemptUserIds($validated['feed_post_approval_exempt_user_ids'])
            : FeedModerationSettings::exemptUserIds((object) $current);

        return FeedModerationSettings::toDatabaseColumns($requireApproval, $exemptUserIds);
    }

    private function hrSettingsPayload(): array
    {
        $settings = $this->currentSettings();
        $attendance = $this->attendancePayload($settings);

        return array_merge([
            'attendance' => $attendance,
            'attendance_datetime_formats' => AttendanceWatermarkSettings::datetimeFormatCatalog(),
            'attendance_watermark_positions' => AttendanceWatermarkSettings::positionCatalog(),
            'attendance_logo_positions' => AttendanceWatermarkSettings::logoPositionCatalog(),
        ], AttendanceWatermarkSettings::toDatabaseColumns($attendance), FeedModerationSettings::payload($settings, true));
    }

    private function updateHrAttendanceSettings(Request $request): JsonResponse
    {
        return $this->updateHrSettings($request);
    }

    private function hrAttendancePayload(): array
    {
        return $this->hrSettingsPayload();
    }

    private function currentSettings(): object
    {
        $defaults = [
            'system_name' => config('app.name', 'EMZI Nexus Brain'),
            'smtp_host' => null,
            'smtp_port' => null,
            'smtp_username' => null,
            'smtp_password' => null,
            'smtp_encryption' => null,
            'smtp_from_email' => config('mail.from.address'),
            'smtp_from_name' => config('mail.from.name'),
            'imap_host' => null,
            'imap_port' => 993,
            'imap_encryption' => 'ssl',
            'splash_animation_style' => SplashAnimationSettings::DEFAULT_STYLE,
            'feed_posts_require_approval' => FeedModerationSettings::DEFAULT_REQUIRE_APPROVAL,
        ];

        if (! Schema::hasTable('app_settings')) {
            return (object) $defaults;
        }

        $settings = DB::table('app_settings')->first();

        if (! $settings) {
            return (object) $defaults;
        }

        // Legacy rows may not have all SMTP columns; merge into safe defaults.
        return (object) array_merge($defaults, (array) $settings);
    }

    private function splashPayload(object $settings): array
    {
        return SplashAnimationSettings::normalizeConfig($settings);
    }

    private function launchPayload(object $settings): array
    {
        return ApplicationLaunchSettings::normalizeConfig($settings);
    }

    private function attendancePayload(object $settings): array
    {
        return AttendanceWatermarkSettings::normalizeConfig($settings);
    }

    private function publicPayload(): array
    {
        $settings = $this->currentSettings();
        $splash = $this->splashPayload($settings);
        $launch = $this->launchPayload($settings);
        $attendance = $this->attendancePayload($settings);

        return [
            'system_name' => $settings->system_name ?: config('app.name', 'EMZI Nexus Brain'),
            'attendance' => $attendance,
            'attendance_datetime_formats' => AttendanceWatermarkSettings::datetimeFormatCatalog(),
            'attendance_watermark_positions' => AttendanceWatermarkSettings::positionCatalog(),
            'attendance_logo_positions' => AttendanceWatermarkSettings::logoPositionCatalog(),
            'splash' => $splash,
            'splash_animation_style' => $splash['animation_style'],
            'splash_animations' => SplashAnimationSettings::catalog(),
            'splash_system_name_animations' => SplashAnimationSettings::systemNameCatalog(),
            'splash_background_styles' => SplashAnimationSettings::backgroundStyleCatalog(),
            'launch' => $launch,
            'launch_animations' => ApplicationLaunchSettings::animationCatalog(),
            'launch_overlay_modes' => ApplicationLaunchSettings::overlayModeCatalog(),
            'launch_progress_styles' => ApplicationLaunchSettings::progressStyleCatalog(),
            'launch_durations' => ApplicationLaunchSettings::durationCatalog(),
            'web_push_enabled' => filled(config('services.web_push.public_key')) && filled(config('services.web_push.private_key')) && filled(config('services.web_push.subject')),
            'web_push_public_key' => config('services.web_push.public_key'),
            'feed_posts_require_approval' => FeedModerationSettings::requireApproval($settings),
        ];
    }

    private function adminPayload(): array
    {
        $settings = $this->currentSettings();
        $splash = $this->splashPayload($settings);
        $launch = $this->launchPayload($settings);
        $attendance = $this->attendancePayload($settings);

        return array_merge([
            'system_name' => $settings->system_name ?: config('app.name', 'EMZI Nexus Brain'),
            'attendance' => $attendance,
            'attendance_datetime_formats' => AttendanceWatermarkSettings::datetimeFormatCatalog(),
            'attendance_watermark_positions' => AttendanceWatermarkSettings::positionCatalog(),
            'attendance_logo_positions' => AttendanceWatermarkSettings::logoPositionCatalog(),
            'smtp_host' => $settings->smtp_host,
            'smtp_port' => $settings->smtp_port,
            'smtp_username' => $settings->smtp_username,
            'smtp_password' => $settings->smtp_password,
            'smtp_encryption' => $settings->smtp_encryption,
            'smtp_from_email' => $settings->smtp_from_email ?: config('mail.from.address'),
            'smtp_from_name' => $settings->smtp_from_name ?: config('mail.from.name'),
            'imap_host' => $settings->imap_host ?? null,
            'imap_port' => $settings->imap_port ?? 993,
            'imap_encryption' => $settings->imap_encryption ?? 'ssl',
            'splash' => $splash,
            'splash_animations' => SplashAnimationSettings::catalog(),
            'splash_system_name_animations' => SplashAnimationSettings::systemNameCatalog(),
            'splash_background_styles' => SplashAnimationSettings::backgroundStyleCatalog(),
            'launch' => $launch,
            'launch_animations' => ApplicationLaunchSettings::animationCatalog(),
            'launch_overlay_modes' => ApplicationLaunchSettings::overlayModeCatalog(),
            'launch_progress_styles' => ApplicationLaunchSettings::progressStyleCatalog(),
            'launch_durations' => ApplicationLaunchSettings::durationCatalog(),
        ], SplashAnimationSettings::toDatabaseColumns($splash), ApplicationLaunchSettings::toDatabaseColumns($launch), AttendanceWatermarkSettings::toDatabaseColumns($attendance), FeedModerationSettings::payload($settings, true));
    }
}
