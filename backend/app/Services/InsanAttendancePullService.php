<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\User;
use Carbon\Carbon;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class InsanAttendancePullService
{
    public function __construct(private ResourceAttendanceForwarder $forwarder)
    {
    }

    /**
     * @return array{
     *     imported: int,
     *     skipped_existing: int,
     *     unmatched: int,
     *     pages: int,
     *     dry_run: bool,
     *     offer_exp: bool
     * }
     */
    public function pull(?Carbon $from = null, ?Carbon $to = null, bool $dryRun = false, bool $offerExp = false): array
    {
        $application = $this->forwarder->resolveResourceApplication();
        if (! $application || ! $application->base_url || ! $application->api_key) {
            throw new \RuntimeException('Insan/Resource application is not configured (enabled, base_url, api_key).');
        }

        $baseUrl = rtrim((string) $application->base_url, '/');
        $manifest = $this->forwarder->fetchManifest($baseUrl) ?? [];
        $exportPath = data_get($manifest, 'endpoints.attendance_export');
        if (! is_string($exportPath) || $exportPath === '') {
            $exportPath = $this->forwarder->defaultAttendanceExportPath();
        }

        $url = $baseUrl.'/'.ltrim($exportPath, '/');
        $apiKey = (string) $application->api_key;

        $stats = [
            'imported' => 0,
            'skipped_existing' => 0,
            'unmatched' => 0,
            'pages' => 0,
            'dry_run' => $dryRun,
            'offer_exp' => $offerExp,
        ];

        $afterId = 0;
        $limit = 200;

        do {
            $query = [
                'after_id' => $afterId,
                'limit' => $limit,
            ];
            if ($from) {
                $query['captured_from'] = $from->toIso8601String();
            }
            if ($to) {
                $query['captured_to'] = $to->toIso8601String();
            }

            $now = time();
            $token = JWT::encode([
                'iss' => config('app.url'),
                'iat' => $now,
                'exp' => $now + 120,
                'sub' => 'system',
                'typ' => 'service',
                'aud' => 'resource-attendance-ingest',
            ], $apiKey, 'HS256');

            $response = Http::timeout(60)
                ->connectTimeout(8)
                ->withToken($token)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'X-Nexus-Api-Key' => $apiKey,
                ])
                ->get($url, $query);

            if (! $response->successful()) {
                throw new \RuntimeException(
                    'Insan attendance export failed: HTTP '.$response->status().' '.$response->body()
                );
            }

            $records = $response->json('records') ?? [];
            $pagination = $response->json('pagination') ?? [];
            $stats['pages']++;

            foreach ($records as $row) {
                if (! is_array($row)) {
                    $stats['unmatched']++;
                    continue;
                }

                $result = $this->importRow($row, $dryRun, $offerExp);
                $stats[$result]++;
            }

            $hasMore = (bool) ($pagination['has_more'] ?? false);
            $afterId = (int) ($pagination['after_id'] ?? $afterId);
            if (! $hasMore || $records === []) {
                break;
            }
        } while (true);

        return $stats;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return 'imported'|'skipped_existing'|'unmatched'
     */
    private function importRow(array $row, bool $dryRun, bool $offerExp): string
    {
        $email = strtolower(trim((string) ($row['email'] ?? '')));
        $type = (string) ($row['type'] ?? '');
        if ($email === '' || ! in_array($type, ['clock_in', 'clock_out'], true)) {
            return 'unmatched';
        }

        $user = User::query()->where('email', $email)->first();
        if (! $user && ! empty($row['nexus_user_id'])) {
            $user = User::query()->where('id', (int) $row['nexus_user_id'])->first();
        }

        if (! $user) {
            Log::warning('Insan attendance pull: unmatched user', [
                'email' => $email,
                'nexus_user_id' => $row['nexus_user_id'] ?? null,
                'insan_id' => $row['id'] ?? null,
            ]);

            return 'unmatched';
        }

        $capturedAt = $this->parseCapturedAt(
            $row['captured_at'] ?? null,
            $row['timezone'] ?? null,
        );

        $insanId = filled($row['id'] ?? null) ? (string) $row['id'] : '';
        $origin = (string) ($row['source'] ?? 'insan');
        $brainExternalId = (string) ($row['external_id'] ?? '');

        if ($this->alreadyExists($user->id, $type, $capturedAt, $insanId, $origin, $brainExternalId)) {
            return 'skipped_existing';
        }

        if ($dryRun) {
            return 'imported';
        }

        $externalId = $insanId !== '' ? $insanId : ($brainExternalId !== '' ? $brainExternalId : $capturedAt->timestamp.'-'.$user->id);

        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => $type,
            'photo_url' => filled($row['photo_url'] ?? null) ? (string) $row['photo_url'] : '',
            'latitude' => $row['latitude'] ?? null,
            'longitude' => $row['longitude'] ?? null,
            'location_label' => $row['location_label'] ?? null,
            'browser' => $row['browser'] ?? null,
            'browser_version' => $row['browser_version'] ?? null,
            'operating_system' => $row['operating_system'] ?? null,
            'device_type' => $row['device_type'] ?? null,
            'screen_resolution' => $row['screen_resolution'] ?? null,
            'timezone' => $row['timezone'] ?? null,
            'ip_address' => $row['ip_address'] ?? null,
            'metadata' => is_array($row['metadata'] ?? null) ? $row['metadata'] : null,
            'captured_at' => $capturedAt,
            'source' => 'insan',
            'external_id' => $externalId,
        ]);

        if ($offerExp) {
            app(GamificationService::class)->offerForAttendanceRecord($user, $record);
        }

        return 'imported';
    }

    private function alreadyExists(
        int $userId,
        string $type,
        Carbon $capturedAt,
        string $insanId,
        string $origin,
        string $brainExternalId,
    ): bool {
        if ($insanId !== '') {
            $byInsanId = AttendanceRecord::query()
                ->whereIn('source', ['insan', 'kashfi', 'resource'])
                ->where('external_id', $insanId)
                ->exists();
            if ($byInsanId) {
                return true;
            }
        }

        if ($origin === 'brain' && $brainExternalId !== '' && ctype_digit($brainExternalId)) {
            $original = AttendanceRecord::query()->find((int) $brainExternalId);
            if ($original
                && (int) $original->user_id === $userId
                && $original->type === $type) {
                return true;
            }
        }

        return AttendanceRecord::query()
            ->where('user_id', $userId)
            ->where('type', $type)
            ->where('captured_at', $capturedAt)
            ->exists();
    }

    private function parseCapturedAt(null|string $value, ?string $timezone = null): Carbon
    {
        if ($value === null || trim((string) $value) === '') {
            return now();
        }

        $value = trim((string) $value);
        $appTz = config('app.timezone') ?: 'Asia/Kuala_Lumpur';

        if (preg_match('/(Z|[+-]\d{2}:?\d{2})$/', $value) === 1) {
            return Carbon::parse($value)->timezone($appTz);
        }

        $tz = filled($timezone) ? $timezone : $appTz;

        try {
            return Carbon::parse($value, $tz)->timezone($appTz);
        } catch (\Throwable) {
            return Carbon::parse($value, $appTz);
        }
    }
}
