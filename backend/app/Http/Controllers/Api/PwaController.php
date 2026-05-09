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
        $name = $settings->system_name ?: config('app.name', 'Nexus');
        $frontendUrl = env('APP_URL');

        return response()->json([
            'name' => $name,
            'short_name' => $name,
            'id' => '/',
            'start_url' => '/',
            'scope' => '/',
            'display' => 'standalone',
            'background_color' => '#0f172a',
            'theme_color' => '#2563eb',
            'description' => 'Unified system access, alerts, and admin controls.',
            'icons' => [
                [
                    'src' => $frontendUrl . '/icons/pwa-icon.svg',
                    'sizes' => 'any',
                    'type' => 'image/svg+xml',
                    'purpose' => 'any maskable',
                ],
            ],
        ])->header('Content-Type', 'application/manifest+json');
    }

    private function currentSettings(): object
    {
        if (! Schema::hasTable('app_settings')) {
            return (object) [
                'system_name' => config('app.name', 'Nexus'),
            ];
        }

        return DB::table('app_settings')->first() ?? (object) [
            'system_name' => config('app.name', 'Nexus'),
        ];
    }
}