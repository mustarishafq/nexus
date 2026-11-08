<?php

namespace App\Services;

use App\Jobs\ForwardAttendanceRecordToResourceJob;
use App\Models\Application;
use App\Models\AttendanceRecord;
use App\Models\SystemEvent;
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

    private const DEFAULT_ATTENDANCE_EXPORT_PATH = '/api/nexus/v1/attendance';

    private const DEFAULT_ATTENDANCE_POLICY_PATH = '/api/nexus/v1/attendance/policy';

    public const DEFAULT_LEGACY_EARLY_CLOCK_OUT_REASON = 'Legacy record (recorded before early clock-out prompt)';

    public const DEFAULT_LEGACY_LATE_CLOCK_IN_REASON = 'Legacy record (recorded before late clock-in prompt)';

    private const CLOSING_PREVIOUS_SHIFT_REASON = 'Closing previous shift';

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

            $result = app(self::class)->forwardWithResult($record, $user);

            if (($result['retryable'] ?? false) === true && config('queue.default') !== 'sync') {
                ForwardAttendanceRecordToResourceJob::dispatch($recordId, $userId)
                    ->delay(now()->addSeconds(10));
            }
        })->afterResponse();
    }

    public function forward(AttendanceRecord $record, User $user): void
    {
        $this->forwardWithResult($record, $user);
    }

    /**
     * @return array{
     *     status: 'pushed'|'retried_with_fallback'|'skipped'|'failed',
     *     http_status: ?int,
     *     retryable: bool,
     *     fallbacks_applied: list<string>,
     *     error: ?string
     * }
     */
    public function forwardWithResult(
        AttendanceRecord $record,
        ?User $user = null,
        bool $allowLegacyFallback = false,
        ?string $legacyReason = null,
    ): array {
        $user = $user ?? $record->user ?? ($record->user_id ? User::query()->find($record->user_id) : null);
        if (! $user) {
            return [
                'status' => 'skipped',
                'http_status' => null,
                'retryable' => false,
                'fallbacks_applied' => [],
                'error' => 'User not found for attendance record.',
            ];
        }

        try {
            $application = $this->resolveResourceApplication();
            if (! $application || ! $application->base_url || ! $application->api_key) {
                return [
                    'status' => 'skipped',
                    'http_status' => null,
                    'retryable' => false,
                    'fallbacks_applied' => [],
                    'error' => 'Resource application not configured.',
                ];
            }

            $manifest = $this->fetchManifest(rtrim($application->base_url, '/'));
            $namedResource = $this->isNamedResourceApplication($application);
            $capabilities = is_array($manifest['capabilities'] ?? null) ? $manifest['capabilities'] : [];

            // Named Insan/Resource apps keep syncing even when well-known is blocked
            // (common on OpenResty/nginx that deny /.well-known/* except ACME).
            if (! $namedResource && ! in_array('attendance.ingest', $capabilities, true)) {
                return [
                    'status' => 'skipped',
                    'http_status' => null,
                    'retryable' => false,
                    'fallbacks_applied' => [],
                    'error' => 'Resource application does not advertise attendance.ingest capability.',
                ];
            }

            $ingestPath = data_get($manifest, 'endpoints.attendance_ingest');
            if (! is_string($ingestPath) || $ingestPath === '') {
                $ingestPath = self::DEFAULT_ATTENDANCE_INGEST_PATH;
            }

            $url = rtrim($application->base_url, '/').'/'.ltrim($ingestPath, '/');
            $apiKey = (string) $application->api_key;
            $payload = $this->buildPayload($record, $user);

            $response = $this->postIngest($url, $apiKey, $payload);

            if ($response->successful()) {
                $this->recordSyncOutcome(
                    record: $record,
                    user: $user,
                    application: $application,
                    syncStatus: 'synced',
                    httpStatus: $response->status(),
                    errorMessage: null,
                );

                return [
                    'status' => 'pushed',
                    'http_status' => $response->status(),
                    'retryable' => false,
                    'fallbacks_applied' => [],
                    'error' => null,
                ];
            }

            $fallbacksApplied = [];

            if ($allowLegacyFallback && $response->status() === 422) {
                for ($attempt = 1; $attempt <= 3 && $response->status() === 422; $attempt++) {
                    $added = $this->applyLegacyIngestFallback(
                        $payload,
                        $record,
                        $user,
                        $response->body(),
                        $fallbacksApplied,
                        $legacyReason,
                    );

                    if ($added === []) {
                        break;
                    }

                    $response = $this->postIngest($url, $apiKey, $payload);
                    if ($response->successful()) {
                        $this->recordSyncOutcome(
                            record: $record,
                            user: $user,
                            application: $application,
                            syncStatus: 'synced',
                            httpStatus: $response->status(),
                            errorMessage: null,
                            fallbacksApplied: $fallbacksApplied,
                        );

                        return [
                            'status' => 'retried_with_fallback',
                            'http_status' => $response->status(),
                            'retryable' => false,
                            'fallbacks_applied' => $fallbacksApplied,
                            'error' => null,
                        ];
                    }
                }
            }

            $status = $response->status();
            $body = $response->body();
            $retryable = $status >= 500 || $status === 429 || $status === 408;
            $cleanError = $this->extractErrorMessage($response, $body);

            Log::warning('Resource attendance ingest failed', [
                'attendance_record_id' => $record->id,
                'status' => $status,
                'body' => $body,
                'url' => $url,
                'fallbacks_applied' => $fallbacksApplied,
            ]);

            $this->recordSyncOutcome(
                record: $record,
                user: $user,
                application: $application,
                syncStatus: $retryable ? 'retrying' : 'failed',
                httpStatus: $status,
                errorMessage: $cleanError,
                fallbacksApplied: $fallbacksApplied,
            );

            return [
                'status' => 'failed',
                'http_status' => $status,
                'retryable' => $retryable,
                'fallbacks_applied' => $fallbacksApplied,
                'error' => sprintf('HTTP %d: %s', $status, $cleanError),
            ];
        } catch (\Throwable $e) {
            Log::warning('Resource attendance forwarder error', [
                'attendance_record_id' => $record->id,
                'message' => $e->getMessage(),
            ]);

            $this->recordSyncOutcome(
                record: $record,
                user: $user,
                application: $application ?? null,
                syncStatus: 'retrying',
                httpStatus: null,
                errorMessage: $e->getMessage(),
            );

            return [
                'status' => 'failed',
                'http_status' => null,
                'retryable' => true,
                'fallbacks_applied' => [],
                'error' => $e->getMessage(),
            ];
        }
    }

    private function extractErrorMessage(\Illuminate\Http\Client\Response $response, string $rawBody): string
    {
        try {
            $json = $response->json();
            if (is_array($json) && is_string($json['message'] ?? null) && trim($json['message']) !== '') {
                return trim($json['message']);
            }
        } catch (\Throwable) {
            // Fall through to raw body.
        }

        return trim($rawBody) !== '' ? trim($rawBody) : 'HTTP '.$response->status();
    }

    private function recordSyncOutcome(
        AttendanceRecord $record,
        User $user,
        ?Application $application,
        string $syncStatus,
        ?int $httpStatus,
        ?string $errorMessage,
        array $fallbacksApplied = [],
    ): void {
        $nowIso = now()->toIso8601String();

        try {
            $metadata = is_array($record->metadata) ? $record->metadata : [];
            $existingSync = is_array($metadata['insan_sync'] ?? null) ? $metadata['insan_sync'] : [];

            $metadata['insan_sync'] = array_filter([
                ...$existingSync,
                'status' => $syncStatus,
                'direction' => 'outbound',
                'http_status' => $httpStatus,
                'attempted_at' => $nowIso,
                'synced_at' => $syncStatus === 'synced' ? $nowIso : ($existingSync['synced_at'] ?? null),
                'error' => $syncStatus === 'synced' ? null : $errorMessage,
                'fallbacks_applied' => $fallbacksApplied !== [] ? $fallbacksApplied : null,
            ], static fn ($v) => $v !== null);

            $record->forceFill(['metadata' => $metadata])->saveQuietly();
        } catch (\Throwable) {
            // Best-effort metadata persistence.
        }

        try {
            $systemId = $application?->slug ?: 'emzi-nexus-insan';
            $typeLabel = $record->type === 'clock_out' ? 'clock_out' : 'clock_in';
            $isSuccess = $syncStatus === 'synced';
            $isRetrying = $syncStatus === 'retrying';

            SystemEvent::query()->create([
                'system_id' => $systemId,
                'event_type' => $isSuccess ? 'webhook' : ($isRetrying ? 'warning' : 'error'),
                'title' => $isSuccess
                    ? sprintf('Outbound %s synced to Insan (%s)', $typeLabel, $user->email)
                    : sprintf(
                        'Outbound %s %s (%s%s)',
                        $typeLabel,
                        $isRetrying ? 'retry queued for Insan' : 'rejected by Insan',
                        $httpStatus ? "HTTP {$httpStatus} · " : '',
                        $user->email,
                    ),
                'status' => $isSuccess ? 'processed' : ($isRetrying ? 'pending' : 'failed'),
                'severity' => $isSuccess ? 2 : ($isRetrying ? 5 : 7),
                'payload' => array_filter([
                    'category' => 'attendance_sync',
                    'direction' => 'outbound',
                    'attendance_record_id' => $record->id,
                    'user_id' => $user->id,
                    'user_email' => $user->email,
                    'punch_type' => $record->type,
                    'captured_at' => $record->captured_at?->toIso8601String(),
                    'http_status' => $httpStatus,
                    'error' => $errorMessage,
                    'fallbacks_applied' => $fallbacksApplied !== [] ? $fallbacksApplied : null,
                ], static fn ($v) => $v !== null),
            ]);
        } catch (\Throwable) {
            // Never break attendance forwarding if system_events logging fails.
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $fallbacksApplied
     * @return list<string>
     */
    private function applyLegacyIngestFallback(
        array &$payload,
        AttendanceRecord $record,
        User $user,
        string $responseBody,
        array &$fallbacksApplied,
        ?string $customReason = null,
    ): array {
        $newlyApplied = [];
        $fallbackEarly = ($customReason !== null && trim($customReason) !== '')
            ? trim($customReason)
            : self::DEFAULT_LEGACY_EARLY_CLOCK_OUT_REASON;
        $fallbackLate = ($customReason !== null && trim($customReason) !== '')
            ? trim($customReason)
            : self::DEFAULT_LEGACY_LATE_CLOCK_IN_REASON;

        if (
            ! in_array('early_clock_out_reason', $fallbacksApplied, true)
            && (
                stripos($responseBody, 'early clock-out reason') !== false
                || stripos($responseBody, 'early_clock_out_reason') !== false
            )
        ) {
            $reason = trim((string) ($payload['early_clock_out_reason'] ?? ''));
            if ($reason === '') {
                $payload['early_clock_out_reason'] = $fallbackEarly;
                data_set($payload, 'metadata.policy.early_clock_out_reason', $fallbackEarly);
                $fallbacksApplied[] = 'early_clock_out_reason';
                $newlyApplied[] = 'early_clock_out_reason';
            }
        }

        if (
            ! in_array('late_clock_in_reason', $fallbacksApplied, true)
            && (
                stripos($responseBody, 'late clock-in reason') !== false
                || stripos($responseBody, 'late_clock_in_reason') !== false
            )
        ) {
            $reason = trim((string) ($payload['late_clock_in_reason'] ?? ''));
            if ($reason === '') {
                $payload['late_clock_in_reason'] = $fallbackLate;
                data_set($payload, 'metadata.policy.late_clock_in_reason', $fallbackLate);
                $fallbacksApplied[] = 'late_clock_in_reason';
                $newlyApplied[] = 'late_clock_in_reason';
            }
        }

        if (
            ! in_array('special_release_pin', $fallbacksApplied, true)
            && stripos($responseBody, 'special release pin') !== false
        ) {
            $coords = $this->resolveLegacySpecialReleasePinCoordinates($record, $user);
            if ($coords !== null) {
                if (! isset($payload['metadata']['brain_original_coordinates'])) {
                    $payload['metadata']['brain_original_coordinates'] = [
                        'latitude' => $payload['latitude'] ?? null,
                        'longitude' => $payload['longitude'] ?? null,
                        'location_label' => $payload['location_label'] ?? null,
                    ];
                }
                $payload['latitude'] = $coords['latitude'];
                $payload['longitude'] = $coords['longitude'];
                $fallbacksApplied[] = 'special_release_pin';
                $newlyApplied[] = 'special_release_pin';
            }
        }

        if (
            ! in_array('missing_location', $fallbacksApplied, true)
            && stripos($responseBody, 'Location is required for attendance') !== false
        ) {
            $coords = $this->resolveLegacyMissingLocationCoordinates($record, $user);
            if ($coords !== null) {
                if (! isset($payload['metadata']['brain_original_coordinates'])) {
                    $payload['metadata']['brain_original_coordinates'] = [
                        'latitude' => $payload['latitude'] ?? null,
                        'longitude' => $payload['longitude'] ?? null,
                        'location_label' => $payload['location_label'] ?? null,
                    ];
                }
                $payload['latitude'] = $coords['latitude'];
                $payload['longitude'] = $coords['longitude'];
                if (empty($payload['location_label']) && ! empty($coords['location_label'])) {
                    $payload['location_label'] = $coords['location_label'];
                }
                $fallbacksApplied[] = 'missing_location';
                $newlyApplied[] = 'missing_location';
            }
        }

        return $newlyApplied;
    }

    /**
     * Resolve fallback coordinates when a historical punch had null GPS in Brain
     * (e.g. allow_clock_out_outside_radius was true when recorded without GPS)
     * but Insan requires location for the user's department.
     *
     * @return array{latitude: float, longitude: float, location_label?: ?string}|null
     */
    private function resolveLegacyMissingLocationCoordinates(AttendanceRecord $record, User $user): ?array
    {
        // 1. Same-day or preceding clock_in with valid GPS coordinates
        if ($record->captured_at) {
            $preceding = AttendanceRecord::query()
                ->where('user_id', $user->id)
                ->where('id', '!=', $record->id)
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->where('captured_at', '<=', $record->captured_at)
                ->orderByDesc('captured_at')
                ->first();

            if ($preceding && $preceding->latitude !== null && $preceding->longitude !== null) {
                return [
                    'latitude' => (float) $preceding->latitude,
                    'longitude' => (float) $preceding->longitude,
                    'location_label' => $preceding->location_label,
                ];
            }
        }

        // 2. Approved special release pin on that date
        $pinCoords = $this->resolveLegacySpecialReleasePinCoordinates($record, $user);
        if ($pinCoords !== null) {
            return $pinCoords;
        }

        // 3. Assigned department / shift AttendanceLocation in Brain
        $setting = \App\Support\AttendancePolicyValidator::resolveForUser($user);
        if ($setting) {
            $location = $setting->attendanceLocation;
            if ($location) {
                $sites = \App\Support\AttendanceLocationSettings::resolveSites($location);
                if ($sites !== [] && isset($sites[0]['latitude'], $sites[0]['longitude'])) {
                    return [
                        'latitude' => (float) $sites[0]['latitude'],
                        'longitude' => (float) $sites[0]['longitude'],
                        'location_label' => $sites[0]['name'] ?? $location->name,
                    ];
                }
                if ($location->center_latitude !== null && $location->center_longitude !== null) {
                    return [
                        'latitude' => (float) $location->center_latitude,
                        'longitude' => (float) $location->center_longitude,
                        'location_label' => $location->name,
                    ];
                }
            }
        }

        // 4. Any other attendance record of this user with coordinates
        $anyRecord = AttendanceRecord::query()
            ->where('user_id', $user->id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderByDesc('captured_at')
            ->first();

        if ($anyRecord && $anyRecord->latitude !== null && $anyRecord->longitude !== null) {
            return [
                'latitude' => (float) $anyRecord->latitude,
                'longitude' => (float) $anyRecord->longitude,
                'location_label' => $anyRecord->location_label,
            ];
        }

        return null;
    }

    /**
     * @return array{latitude: float, longitude: float}|null
     */
    private function resolveLegacySpecialReleasePinCoordinates(AttendanceRecord $record, User $user): ?array
    {
        $tz = $record->timezone ?: (config('app.timezone') ?: 'Asia/Kuala_Lumpur');
        $date = ($record->captured_at ?? now())->copy()->timezone($tz)->toDateString();

        try {
            $pin = app(ResourceSpecialReleaseClient::class)->findApprovedForUserOnDate($user->id, $date);
            if ($pin) {
                return [
                    'latitude' => (float) $pin->centerLatitude,
                    'longitude' => (float) $pin->centerLongitude,
                ];
            }
        } catch (\Throwable) {
            // Fall through to local record lookup.
        }

        $siblingPinRecord = AttendanceRecord::query()
            ->where('user_id', $user->id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->where('location_label', 'like', 'Special release%')
            ->orderByDesc('captured_at')
            ->first();

        if ($siblingPinRecord && $siblingPinRecord->latitude !== null && $siblingPinRecord->longitude !== null) {
            return [
                'latitude' => (float) $siblingPinRecord->latitude,
                'longitude' => (float) $siblingPinRecord->longitude,
            ];
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPayload(AttendanceRecord $record, User $user): array
    {
        $user->loadMissing('department:id,name');

        $payload = [
            'external_id' => (string) $record->id,
            'nexus_user_id' => (string) $user->id,
            'email' => $user->email,
            'department_name' => $user->department?->name,
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
            'metadata' => is_array($record->metadata) ? $record->metadata : [],
        ];

        $lateReason = data_get($record->metadata, 'policy.late_clock_in_reason');
        if (is_string($lateReason) && trim($lateReason) !== '') {
            $payload['late_clock_in_reason'] = trim($lateReason);
        }

        $earlyReason = data_get($record->metadata, 'policy.early_clock_out_reason');
        if (is_string($earlyReason) && trim($earlyReason) !== '') {
            $payload['early_clock_out_reason'] = trim($earlyReason);
        } elseif ($record->type === 'clock_out' && data_get($record->metadata, 'policy.closing_previous_shift') === true) {
            // When closing a previous day's forgotten clock-out, Brain rightly does not prompt
            // for an early clock-out reason; supply a descriptive reason so Insan never rejects
            // morning clock-outs of yesterday's shift with HTTP 422.
            $payload['early_clock_out_reason'] = self::CLOSING_PREVIOUS_SHIFT_REASON;
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function postIngest(string $url, string $apiKey, array $payload): \Illuminate\Http\Client\Response
    {
        $now = time();
        $serviceToken = JWT::encode([
            'iss' => config('app.url'),
            'iat' => $now,
            'exp' => $now + 120,
            'sub' => 'system',
            'typ' => 'service',
            'aud' => 'resource-attendance-ingest',
        ], $apiKey, 'HS256');

        return Http::timeout(self::HTTP_TIMEOUT_SECONDS)
            ->withToken($serviceToken)
            ->withHeaders([
                'Accept' => 'application/json',
                'X-Nexus-Api-Key' => $apiKey,
            ])
            ->post($url, $payload);
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

    public function defaultAttendanceExportPath(): string
    {
        return self::DEFAULT_ATTENDANCE_EXPORT_PATH;
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
                ->connectTimeout(1)
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
