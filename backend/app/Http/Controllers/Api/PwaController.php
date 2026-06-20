<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PwaController extends Controller
{
    private const DEFAULT_THEME_COLOR = '#022E96';

    public function manifest(): JsonResponse
    {
        $settings = $this->currentSettings();
        $name = $settings->system_name ?: config('app.name', 'EMZI Nexus Brain');
        $frontendUrl = rtrim((string) env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')), '/');
        $themeColor = $this->normalizeHexColor($settings->splash_background_color ?? null);

        return response()->json([
            'name' => $name,
            'short_name' => $name,
            'id' => "{$frontendUrl}/",
            'start_url' => "{$frontendUrl}/",
            'scope' => "{$frontendUrl}/",
            'display' => 'standalone',
            'background_color' => $themeColor,
            'theme_color' => $themeColor,
            'description' => 'Unified system access, alerts, and admin controls.',
            'icons' => [
                [
                    'src' => "{$frontendUrl}/icons/apple-touch-icon.png",
                    'sizes' => '180x180',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src' => "{$frontendUrl}/icons/pwa-icon-192.png",
                    'sizes' => '192x192',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src' => "{$frontendUrl}/icons/pwa-icon-512.png",
                    'sizes' => '512x512',
                    'type' => 'image/png',
                    'purpose' => 'any maskable',
                ],
            ],
        ])->header('Content-Type', 'application/manifest+json');
    }

    private function currentSettings(): object
    {
        if (! Schema::hasTable('app_settings')) {
            return (object) [
                'system_name' => config('app.name', 'EMZI Nexus Brain'),
                'splash_background_color' => self::DEFAULT_THEME_COLOR,
            ];
        }

        return DB::table('app_settings')->first() ?? (object) [
            'system_name' => config('app.name', 'EMZI Nexus Brain'),
            'splash_background_color' => self::DEFAULT_THEME_COLOR,
        ];
    }

    private function normalizeHexColor(mixed $value): string
    {
        if (! is_string($value)) {
            return self::DEFAULT_THEME_COLOR;
        }

        $trimmed = trim($value);

        if (preg_match('/^#[0-9A-Fa-f]{6}$/', $trimmed) !== 1) {
            return self::DEFAULT_THEME_COLOR;
        }

        return strtoupper($trimmed);
    }
}