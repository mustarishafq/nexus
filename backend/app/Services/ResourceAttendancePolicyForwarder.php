<?php

namespace App\Services;

use App\Support\AttendancePolicySyncGuard;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ResourceAttendancePolicyForwarder
{
    private const HTTP_TIMEOUT_SECONDS = 20;

    /**
     * @return array{ok: bool, skipped?: bool, status?: int, message?: string, stats?: array<string, mixed>}|null
     */
    public function pushAfterResponse(): void
    {
        if (AttendancePolicySyncGuard::skipPush()) {
            return;
        }

        dispatch(function () {
            app(self::class)->push();
        })->afterResponse();
    }

    /**
     * @return array{ok: bool, skipped?: bool, status?: int|null, message?: string, body?: mixed}
     */
    public function push(): array
    {
        if (AttendancePolicySyncGuard::skipPush()) {
            return ['ok' => true, 'skipped' => true];
        }

        try {
            $attendanceForwarder = app(ResourceAttendanceForwarder::class);
            $application = $attendanceForwarder->resolveResourceApplication();
            if (! $application || ! $application->base_url || ! $application->api_key) {
                return ['ok' => false, 'skipped' => true, 'message' => 'Resource application not configured'];
            }

            $baseUrl = rtrim((string) $application->base_url, '/');
            $manifest = $attendanceForwarder->fetchManifest($baseUrl);
            $namedResource = $attendanceForwarder->isNamedResourceApplication($application);
            $capabilities = is_array($manifest['capabilities'] ?? null) ? $manifest['capabilities'] : [];

            // Named Insan/Resource apps keep syncing even when well-known is blocked
            // (cloud OpenResty often returns 403 for /.well-known/nexus-integration.json).
            if (! $namedResource && ! in_array('attendance.policy', $capabilities, true)) {
                return ['ok' => false, 'skipped' => true, 'message' => 'Peer missing attendance.policy capability'];
            }

            $path = data_get($manifest, 'endpoints.attendance_policy');
            if (! is_string($path) || $path === '') {
                $path = $attendanceForwarder->defaultAttendancePolicyPath();
            }

            $url = $baseUrl.'/'.ltrim($path, '/');
            $apiKey = (string) $application->api_key;
            $now = time();
            $token = JWT::encode([
                'iss' => config('app.url'),
                'iat' => $now,
                'exp' => $now + 120,
                'sub' => 'system',
                'typ' => 'service',
                'aud' => 'brain-attendance-policy',
            ], $apiKey, 'HS256');

            $payload = app(AttendancePolicySnapshotService::class)->export();
            $payload['prune_missing'] = true;

            $response = Http::timeout(self::HTTP_TIMEOUT_SECONDS)
                ->withToken($token)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'X-Nexus-Api-Key' => $apiKey,
                    'X-Nexus-Policy-Sync' => '1',
                ])
                ->put($url, $payload);

            if (! $response->successful()) {
                Log::warning('Resource attendance policy push failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'url' => $url,
                ]);

                return [
                    'ok' => false,
                    'status' => $response->status(),
                    'message' => 'Peer rejected policy push',
                    'body' => $response->json() ?? $response->body(),
                ];
            }

            return [
                'ok' => true,
                'status' => $response->status(),
                'body' => $response->json(),
            ];
        } catch (\Throwable $e) {
            Log::warning('Resource attendance policy push error', [
                'message' => $e->getMessage(),
            ]);

            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }
}
