<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiTokenAuth;
use App\Support\ApplicationLaunchSettings;
use App\Support\SplashAnimationSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AppSettingController extends Controller
{
    public function publicShow(): JsonResponse
    {
        return response()->json($this->publicPayload());
    }

    public function show(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        return response()->json($this->adminPayload());
    }

    public function update(Request $request): JsonResponse
    {
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
            'splash_animation_style' => ['nullable', 'string', 'in:'.implode(',', SplashAnimationSettings::allowedValues())],
        ], SplashAnimationSettings::validationRules(), ApplicationLaunchSettings::validationRules()));

        $current = (array) DB::table('app_settings')->first();
        $splash = SplashAnimationSettings::normalizeConfig(array_merge($current, $validated));
        $launch = ApplicationLaunchSettings::normalizeConfig(array_merge($current, $validated));

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
                'updated_at' => now(),
            ], SplashAnimationSettings::toDatabaseColumns($splash), ApplicationLaunchSettings::toDatabaseColumns($launch)));
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
                'created_at' => now(),
                'updated_at' => now(),
            ], SplashAnimationSettings::toDatabaseColumns($splash), ApplicationLaunchSettings::toDatabaseColumns($launch)));
        }

        return response()->json($this->adminPayload());
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
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
            'splash_animation_style' => SplashAnimationSettings::DEFAULT_STYLE,
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

    private function publicPayload(): array
    {
        $settings = $this->currentSettings();
        $splash = $this->splashPayload($settings);
        $launch = $this->launchPayload($settings);

        return [
            'system_name' => $settings->system_name ?: config('app.name', 'EMZI Nexus Brain'),
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
        ];
    }

    private function adminPayload(): array
    {
        $settings = $this->currentSettings();
        $splash = $this->splashPayload($settings);
        $launch = $this->launchPayload($settings);

        return array_merge([
            'system_name' => $settings->system_name ?: config('app.name', 'EMZI Nexus Brain'),
            'smtp_host' => $settings->smtp_host,
            'smtp_port' => $settings->smtp_port,
            'smtp_username' => $settings->smtp_username,
            'smtp_password' => $settings->smtp_password,
            'smtp_encryption' => $settings->smtp_encryption,
            'smtp_from_email' => $settings->smtp_from_email ?: config('mail.from.address'),
            'smtp_from_name' => $settings->smtp_from_name ?: config('mail.from.name'),
            'splash' => $splash,
            'splash_animations' => SplashAnimationSettings::catalog(),
            'splash_system_name_animations' => SplashAnimationSettings::systemNameCatalog(),
            'splash_background_styles' => SplashAnimationSettings::backgroundStyleCatalog(),
            'launch' => $launch,
            'launch_animations' => ApplicationLaunchSettings::animationCatalog(),
            'launch_overlay_modes' => ApplicationLaunchSettings::overlayModeCatalog(),
            'launch_progress_styles' => ApplicationLaunchSettings::progressStyleCatalog(),
            'launch_durations' => ApplicationLaunchSettings::durationCatalog(),
        ], SplashAnimationSettings::toDatabaseColumns($splash), ApplicationLaunchSettings::toDatabaseColumns($launch));
    }
}