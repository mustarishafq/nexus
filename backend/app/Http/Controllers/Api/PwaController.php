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

        return response()->json([
            'name' => $name,
            'short_name' => $name,
            'id' => '/',
            'start_url' => '/',
            'scope' => '/',
            'display' => 'standalone',
            'background_color' => '#01298c',
            'theme_color' => '#01298c',
            'description' => 'Unified system access, alerts, and admin controls.',
            'icons' => [
                // [
                //     'src' => '/icons/pwa-icon-192x192.png',
                //     'sizes' => '192x192',
                //     'type' => 'image/png',
                //     'purpose' => 'any',
                // ],
                // [
                //     'src' => '/icons/pwa-icon-512x512.png',
                //     'sizes' => '512x512',
                //     'type' => 'image/png',
                //     'purpose' => 'any maskable',
                // ],
                [
                    'src' => '/icons/logo.svg',
                    'sizes' => 'any',
                    'type' => 'image/svg+xml',
                    'purpose' => 'any',
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