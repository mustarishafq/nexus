<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PwaController extends Controller
{
    public function manifest(): JsonResponse
    {
        $settings = $this->currentSettings();
        $name = $settings->system_name ?: config('app.name', 'EMZI Nexus Brain');
        $frontendUrl = rtrim((string) env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')), '/');

        return response()->json([
            'name' => $name,
            'short_name' => $name,
            'id' => "{$frontendUrl}/",
            'start_url' => "{$frontendUrl}/",
            'scope' => "{$frontendUrl}/",
            'display' => 'standalone',
            'background_color' => '#022e96',
            'theme_color' => '#022e96',
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
            ];
        }

        return DB::table('app_settings')->first() ?? (object) [
            'system_name' => config('app.name', 'EMZI Nexus Brain'),
        ];
    }
}