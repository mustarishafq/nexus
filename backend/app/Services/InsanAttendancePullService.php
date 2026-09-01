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
     *     exp_offered: int,
     *     pages: int,
     *     dry_run: bool,
     *     offer_exp: bool,
     *     offer_exp_on: ?string
     * }
     */
    public function pull(
        ?Carbon $from = null,
        ?Carbon $to = null,
        bool $dryRun = false,
        bool $offerExp = false,
        ?string $offerExpOn = null,
    ): array {
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
        $offerExpOn = $offerExpOn !== null && trim($offerExpOn) !== ''
            ? Carbon::parse(trim($offerExpOn))->toDateString()
            : null;

        $stats = [
            'imported' => 0,
            'skipped_existing' => 0,
            'unmatched' => 0,
            'exp_offered' => 0,
            'pages' => 0,
            'dry_run' => $dryRun,
            'offer_exp' => $offerExp || $offerExpOn !== null,
            'offer_exp_on' => $offerExpOn,
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

                $result = $this->importRow($row, $dryRun, $offerExp, $offerExpOn);
                $stats[$result['status']]++;
                $stats['exp_offered'] += $result['exp_offered'] ? 1 : 0;
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
     * @return array{status: 'imported'|'skipped_existing'|'unmatched', exp_offered: bool}
     */
    private function importRow(array $row, bool $dryRun, bool $offerExp, ?string $offerExpOn): array
    {
        $email = strtolower(trim((string) ($row['email'] ?? '')));
        $type = (string) ($row['type'] ?? '');
        if ($email === '' || ! in_array($type, ['clock_in', 'clock_out'], true)) {
            return ['status' => 'unmatched', 'exp_offered' => false];
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

            return ['status' => 'unmatched', 'exp_offered' => false];
        }

        $capturedAt = $this->parseCapturedAt(
            $row['captured_at'] ?? null,
            $row['timezone'] ?? null,
        );

        $insanId = filled($row['id'] ?? null) ? (string) $row['id'] : '';
        $origin = (string) ($row['source'] ?? 'insan');
        $brainExternalId = (string) ($row['external_id'] ?? '');
        $existing = $this->findExisting($user->id, $type, $capturedAt, $insanId, $origin, $brainExternalId);

        if ($existing) {
            $expOffered = false;
            if (! $dryRun) {
                $expOffered = $this->maybeOfferExp($user, $existing, $capturedAt, $offerExp, $offerExpOn);
            }

            return ['status' => 'skipped_existing', 'exp_offered' => $expOffered];
        }

        if ($dryRun) {
            return ['status' => 'imported', 'exp_offered' => false];
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

        $expOffered = $this->maybeOfferExp($user, $record, $capturedAt, $offerExp, $offerExpOn);

        return ['status' => 'imported', 'exp_offered' => $expOffered];
    }

    private function maybeOfferExp(
        User $user,
        AttendanceRecord $record,
        Carbon $capturedAt,
        bool $offerExp,
        ?string $offerExpOn,
    ): bool {
        if ($offerExpOn !== null) {
            $timezone = (string) (config('app.timezone') ?: 'Asia/Kuala_Lumpur');
            if ($capturedAt->copy()->timezone($timezone)->toDateString() !== $offerExpOn) {
                return false;
            }
        } elseif (! $offerExp) {
            return false;
        }

        $offers = app(GamificationService::class)->offerForAttendanceRecord($user, $record);

        return collect($offers)->filter()->isNotEmpty();
    }

    private function findExisting(
        int $userId,
        string $type,
        Carbon $capturedAt,
        string $insanId,
        string $origin,
        string $brainExternalId,
    ): ?AttendanceRecord {
        if ($insanId !== '') {
            $byInsanId = AttendanceRecord::query()
                ->whereIn('source', ['insan', 'kashfi', 'resource'])
                ->where('external_id', $insanId)
                ->first();
            if ($byInsanId) {
                return $byInsanId;
            }
        }

        if ($origin === 'brain' && $brainExternalId !== '' && ctype_digit($brainExternalId)) {
            $original = AttendanceRecord::query()->find((int) $brainExternalId);
            if ($original
                && (int) $original->user_id === $userId
                && $original->type === $type) {
                return $original;
            }
        }

        return AttendanceRecord::query()
            ->where('user_id', $userId)
            ->where('type', $type)
            ->where('captured_at', $capturedAt)
            ->first();
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
