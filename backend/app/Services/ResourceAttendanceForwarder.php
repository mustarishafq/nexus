<?php

namespace App\Services;

use App\Models\Application;
use App\Models\AttendanceRecord;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ResourceAttendanceForwarder
{
    public const RESOURCE_APP_NAME = 'EMZI Nexus Resource';

    /** @var list<string> */
    public const RESOURCE_APP_NAME_MATCHERS = [
        'EMZI Nexus Resource',
        'EMZI Nexus Insan',
        'EMZI Nexus Kashfi',
    ];

    private const WELL_KNOWN_CACHE_SECONDS = 300;

    private const HTTP_TIMEOUT_SECONDS = 8;

    private const DEFAULT_ATTENDANCE_INGEST_PATH = '/api/nexus/v1/attendance/ingest';

    private const DEFAULT_ATTENDANCE_POLICY_PATH = '/api/nexus/v1/attendance/policy';

    public function forwardAfterResponse(AttendanceRecord $record, User $user): void
    {
        $recordId = $record->id;
        $userId = $user->id;

        dispatch(function () use ($recordId, $userId) {
            $record = AttendanceRecord::query()->with('user')->find($recordId);
            $user = User::query()->find($userId);

            if (! $record || ! $user) {
                return;
            }

            app(self::class)->forward($record, $user);
        })->afterResponse();
    }

    public function forward(AttendanceRecord $record, User $user): void
    {
        try {
            $application = $this->resolveResourceApplication();
            if (! $application || ! $application->base_url || ! $application->api_key) {
                return;
            }

            $manifest = $this->fetchManifest(rtrim($application->base_url, '/'));
            $namedResource = $this->isNamedResourceApplication($application);
            $capabilities = is_array($manifest['capabilities'] ?? null) ? $manifest['capabilities'] : [];

            // Named Insan/Resource apps keep syncing even when well-known is blocked
            // (common on OpenResty/nginx that deny /.well-known/* except ACME).
            if (! $namedResource && ! in_array('attendance.ingest', $capabilities, true)) {
                return;
            }

            $ingestPath = data_get($manifest, 'endpoints.attendance_ingest');
            if (! is_string($ingestPath) || $ingestPath === '') {
                $ingestPath = self::DEFAULT_ATTENDANCE_INGEST_PATH;
            }

            $url = rtrim($application->base_url, '/').'/'.ltrim($ingestPath, '/');
            $apiKey = (string) $application->api_key;
            $now = time();
            $serviceToken = JWT::encode([
                'iss' => config('app.url'),
                'iat' => $now,
                'exp' => $now + 120,
                'sub' => 'system',
                'typ' => 'service',
                'aud' => 'resource-attendance-ingest',
            ], $apiKey, 'HS256');

            $payload = [
                'external_id' => (string) $record->id,
                'nexus_user_id' => (string) $user->id,
                'email' => $user->email,
                'type' => $record->type,
                'captured_at' => $record->captured_at?->toIso8601String() ?? now()->toIso8601String(),
                'photo_url' => $record->photo_url,
                'latitude' => $record->latitude !== null ? (float) $record->latitude : null,
                'longitude' => $record->longitude !== null ? (float) $record->longitude : null,
                'location_label' => $record->location_label,
                'browser' => $record->browser,
                'browser_version' => $record->browser_version,
                'operating_system' => $record->operating_system,
                'device_type' => $record->device_type,
                'screen_resolution' => $record->screen_resolution,
                'timezone' => $record->timezone,
                'ip_address' => $record->ip_address,
                'metadata' => $record->metadata ?? [],
            ];

            $lateReason = data_get($record->metadata, 'policy.late_clock_in_reason');
            if (is_string($lateReason) && trim($lateReason) !== '') {
                $payload['late_clock_in_reason'] = trim($lateReason);
            }

            $earlyReason = data_get($record->metadata, 'policy.early_clock_out_reason');
            if (is_string($earlyReason) && trim($earlyReason) !== '') {
                $payload['early_clock_out_reason'] = trim($earlyReason);
            }

            $response = Http::timeout(self::HTTP_TIMEOUT_SECONDS)
                ->withToken($serviceToken)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'X-Nexus-Api-Key' => $apiKey,
                ])
                ->post($url, $payload);

            if (! $response->successful()) {
                Log::warning('Resource attendance ingest failed', [
                    'attendance_record_id' => $record->id,
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'url' => $url,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Resource attendance forwarder error', [
                'attendance_record_id' => $record->id,
                'message' => $e->getMessage(),
            ]);
        }
    }

    public function resolveResourceApplication(): ?Application
    {
        $named = Application::query()
            ->where('is_enabled', true)
            ->whereNotNull('base_url')
            ->whereNotNull('api_key')
            ->where('api_key', '!=', '')
            ->where(function ($query) {
                $this->applyNamedResourceConstraints($query);
            })
            ->orderBy('sort_order')
            ->first();

        if ($named) {
            return $named;
        }

        $candidates = Application::query()
            ->where('is_enabled', true)
            ->whereNotNull('base_url')
            ->whereNotNull('api_key')
            ->where('api_key', '!=', '')
            ->orderBy('sort_order')
            ->get();

        foreach ($candidates as $application) {
            $manifest = $this->fetchManifest(rtrim((string) $application->base_url, '/'));
            $capabilities = $manifest['capabilities'] ?? [];
            if (is_array($capabilities) && in_array('attendance.ingest', $capabilities, true)) {
                return $application;
            }
        }

        return null;
    }

    public function isNamedResourceApplication(?Application $application): bool
    {
        if (! $application) {
            return false;
        }

        $name = (string) $application->name;
        $slug = (string) $application->slug;

        foreach (self::RESOURCE_APP_NAME_MATCHERS as $matcher) {
            if (strcasecmp($name, $matcher) === 0) {
                return true;
            }
        }

        foreach (['Resource', 'Insan', 'Kashfi'] as $needle) {
            if (stripos($name, $needle) !== false) {
                return true;
            }
        }

        foreach (['resource', 'insan', 'kashfi'] as $needle) {
            if (stripos($slug, $needle) !== false) {
                return true;
            }
        }

        return false;
    }

    public function defaultAttendanceIngestPath(): string
    {
        return self::DEFAULT_ATTENDANCE_INGEST_PATH;
    }

    public function defaultAttendancePolicyPath(): string
    {
        return self::DEFAULT_ATTENDANCE_POLICY_PATH;
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\App\Models\Application>|\Illuminate\Database\Query\Builder  $query
     */
    public function applyNamedResourceConstraints($query): void
    {
        foreach (self::RESOURCE_APP_NAME_MATCHERS as $name) {
            $query->orWhere('name', $name);
        }
        $query->orWhere('name', 'like', '%Resource%')
            ->orWhere('name', 'like', '%Insan%')
            ->orWhere('name', 'like', '%Kashfi%')
            ->orWhere('slug', 'like', '%resource%')
            ->orWhere('slug', 'like', '%insan%')
            ->orWhere('slug', 'like', '%kashfi%');
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchManifest(string $baseUrl): ?array
    {
        $cacheKey = 'resource_well_known:'.md5($baseUrl);
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        try {
            $response = Http::timeout(4)
                ->acceptJson()
                ->get($baseUrl.'/.well-known/nexus-integration.json');

            if (! $response->successful()) {
                return null;
            }

            $json = $response->json();
            if (! is_array($json)) {
                return null;
            }

            // Only cache successful manifests — failed fetches (403 on cloud) must retry.
            Cache::put($cacheKey, $json, self::WELL_KNOWN_CACHE_SECONDS);

            return $json;
        } catch (\Throwable) {
            return null;
        }
    }
}
