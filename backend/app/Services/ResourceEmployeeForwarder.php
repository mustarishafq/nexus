<?php

namespace App\Services;

use App\Models\User;
use App\Support\EmployeeSyncGuard;
use App\Support\EmployeeSyncSerializer;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Pushes Brain staff/profile snapshots to Insan (bidirectional employee sync).
 */
class ResourceEmployeeForwarder
{
    private const HTTP_TIMEOUT_SECONDS = 60;

    private const DEFAULT_EMPLOYEES_SYNC_PATH = '/api/nexus/v1/employees';

    public function pushUserAfterResponse(User $user): void
    {
        if (EmployeeSyncGuard::skipPush()) {
            return;
        }

        $userId = $user->id;
        dispatch(function () use ($userId) {
            $user = User::query()->withTrashed()->find($userId);
            if (! $user) {
                return;
            }
            app(self::class)->pushUsers([$user]);
        })->afterResponse();
    }

    /**
     * @param  list<User>  $users
     * @return array{ok: bool, skipped?: bool, status?: int|null, message?: string, stats?: array<string, mixed>}
     */
    public function pushUsers(array $users): array
    {
        if (EmployeeSyncGuard::skipPush()) {
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

            if (! $namedResource && ! in_array('employees.sync', $capabilities, true)) {
                return ['ok' => false, 'skipped' => true, 'message' => 'Peer missing employees.sync capability'];
            }

            $path = data_get($manifest, 'endpoints.employees_sync');
            if (! is_string($path) || $path === '') {
                $path = self::DEFAULT_EMPLOYEES_SYNC_PATH;
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
                'aud' => 'brain-employees',
            ], $apiKey, 'HS256');

            $employees = array_map(
                fn (User $user) => EmployeeSyncSerializer::serialize($user),
                $users
            );

            $response = Http::timeout(self::HTTP_TIMEOUT_SECONDS)
                ->withToken($token)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'X-Nexus-Api-Key' => $apiKey,
                    'X-Nexus-Employee-Sync' => '1',
                ])
                ->put($url, ['employees' => $employees]);

            if (! $response->successful()) {
                Log::warning('Resource employee push failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'url' => $url,
                ]);

                return [
                    'ok' => false,
                    'status' => $response->status(),
                    'message' => 'Peer rejected employee push',
                ];
            }

            return [
                'ok' => true,
                'status' => $response->status(),
                'stats' => is_array($response->json('stats')) ? $response->json('stats') : [],
            ];
        } catch (\Throwable $e) {
            Log::warning('Resource employee forwarder error', ['message' => $e->getMessage()]);

            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }
}
