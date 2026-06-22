<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\AttendancePolicyValidator;
use App\Support\AttendanceReminderEvaluator;
use App\Support\AttendanceWatermarkSettings;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceController extends Controller
{
    public function watermarkLogo(Request $request): BinaryFileResponse|JsonResponse|Response
    {
        try {
            $validated = $request->validate([
                'path' => ['required', 'string', 'max:2048'],
            ]);

            $path = $validated['path'];

            if (! preg_match('#^/storage/attendance-watermark-logos/[A-Za-z0-9._\-]+$#', $path)) {
                return response()->json(['message' => 'Invalid logo path.'], 422);
            }

            $relative = substr($path, strlen('/storage/'));
            $fullPath = $this->resolveWatermarkLogoPath($relative);

            if ($fullPath === null) {
                return response()->json(['message' => 'Logo not found.'], 404);
            }

            return response()->file($fullPath, [
                'Content-Type' => $this->guessWatermarkLogoMimeType($fullPath),
                'Cache-Control' => 'private, max-age=3600',
            ]);
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json(['message' => 'Unable to load logo.'], 500);
        }
    }

    private function resolveWatermarkLogoPath(string $relative): ?string
    {
        $candidates = [
            public_path('storage/'.$relative),
        ];

        if (Storage::disk('public')->exists($relative)) {
            $candidates[] = Storage::disk('public')->path($relative);
        }

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && is_readable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function guessWatermarkLogoMimeType(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            default => 'image/png',
        };
    }

    public function reverseGeocode(Request $request): JsonResponse
    {
        if ($response = $this->authorizeUser($request)) {
            return $response;
        }

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $response = Http::withHeaders([
            'User-Agent' => 'EMZI Nexus Attendance/1.0',
            'Accept' => 'application/json',
        ])->get('https://nominatim.openstreetmap.org/reverse', [
            'lat' => $validated['latitude'],
            'lon' => $validated['longitude'],
            'format' => 'json',
            'addressdetails' => 1,
            'zoom' => 18,
        ]);

        if (! $response->successful()) {
            return response()->json(['location_label' => null]);
        }

        $payload = $response->json();

        return response()->json([
            'location_label' => $this->formatAddressLabel(
                $payload['address'] ?? [],
                $payload['display_name'] ?? ''
            ),
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        if ($response = $this->authorizeUser($request)) {
            return $response;
        }

        $user = ApiTokenAuth::userFromRequest($request);
        $user->loadMissing('department');

        $setting = AttendancePolicyValidator::resolveForUser($user);
        $timezone = $setting?->timezone ?? config('app.timezone');
        $todayStart = now()->timezone($timezone)->startOfDay()->utc();
        $todayEnd = now()->timezone($timezone)->endOfDay()->utc();

        $todayRecords = AttendanceRecord::query()
            ->where('user_id', $user->id)
            ->whereBetween('captured_at', [$todayStart, $todayEnd])
            ->orderByDesc('captured_at')
            ->get();

        $lastRecord = AttendanceRecord::query()
            ->where('user_id', $user->id)
            ->orderByDesc('captured_at')
            ->first();

        $nextType = $this->resolveNextType($lastRecord);
        $reminder = AttendanceReminderEvaluator::evaluate($user, $lastRecord, $todayRecords);

        return response()->json([
            'next_type' => $nextType,
            'last_record' => $lastRecord ? $this->serializeRecord($lastRecord) : null,
            'today_records' => $todayRecords->map(fn (AttendanceRecord $record) => $this->serializeRecord($record))->values(),
            'today_summary' => [
                'clock_ins' => $todayRecords->where('type', 'clock_in')->count(),
                'clock_outs' => $todayRecords->where('type', 'clock_out')->count(),
            ],
            'policy' => AttendancePolicyValidator::policySummaryForUser($user),
            'reminder' => $reminder,
            'schedule_hint' => AttendanceReminderEvaluator::scheduleHintForUser($user),
        ]);
    }

    public function myHistory(Request $request): JsonResponse
    {
        if ($response = $this->authorizeUser($request)) {
            return $response;
        }

        $user = ApiTokenAuth::userFromRequest($request);
        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = AttendanceRecord::query()
            ->where('user_id', $user->id)
            ->orderByDesc('captured_at');

        if (! empty($validated['date_from'])) {
            $query->where('captured_at', '>=', Carbon::parse($validated['date_from'])->startOfDay());
        }

        if (! empty($validated['date_to'])) {
            $query->where('captured_at', '<=', Carbon::parse($validated['date_to'])->endOfDay());
        }

        $limit = $validated['limit'] ?? 50;
        $records = $query->limit($limit)->get();

        return response()->json([
            'records' => $records->map(fn (AttendanceRecord $record) => $this->serializeRecord($record))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizeUser($request)) {
            return $response;
        }

        $user = ApiTokenAuth::userFromRequest($request);
        $user->loadMissing('department');

        if (! $this->isAttendanceEnabled()) {
            return response()->json(['message' => 'Attendance has been disabled by an administrator.'], 403);
        }

        $validated = $request->validate([
            'type' => ['required', 'in:clock_in,clock_out'],
            'photo_url' => ['required', 'string', 'max:2048'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'location_label' => ['nullable', 'string', 'max:512'],
            'browser' => ['nullable', 'string', 'max:64'],
            'browser_version' => ['nullable', 'string', 'max:32'],
            'operating_system' => ['nullable', 'string', 'max:64'],
            'device_type' => ['nullable', 'string', 'max:32'],
            'screen_resolution' => ['nullable', 'string', 'max:32'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'metadata' => ['nullable', 'array'],
            'captured_at' => ['nullable', 'date'],
        ]);

        $lastRecord = AttendanceRecord::query()
            ->where('user_id', $user->id)
            ->orderByDesc('captured_at')
            ->first();

        $expectedType = $this->resolveNextType($lastRecord);

        if ($validated['type'] !== $expectedType) {
            return response()->json([
                'message' => $expectedType === 'clock_in'
                    ? 'You need to clock in first.'
                    : 'You are already clocked in. Please clock out.',
            ], 422);
        }

        $capturedAt = isset($validated['captured_at'])
            ? Carbon::parse($validated['captured_at'])
            : now();

        $policyResult = AttendancePolicyValidator::validateClock(
            $user,
            $validated['type'],
            isset($validated['latitude']) ? (float) $validated['latitude'] : null,
            isset($validated['longitude']) ? (float) $validated['longitude'] : null,
            $capturedAt,
            $lastRecord,
        );

        if (! $policyResult['valid']) {
            return response()->json([
                'message' => $policyResult['errors'][0] ?? 'Attendance policy validation failed.',
                'errors' => $policyResult['errors'],
            ], 422);
        }

        $metadata = array_merge(
            $validated['metadata'] ?? [],
            ['policy' => $policyResult['metadata']],
        );

        if ($policyResult['warnings'] !== []) {
            $metadata['policy_warnings'] = $policyResult['warnings'];
        }

        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => $validated['type'],
            'photo_url' => $validated['photo_url'],
            'latitude' => $validated['latitude'] ?? null,
            'longitude' => $validated['longitude'] ?? null,
            'location_label' => $validated['location_label'] ?? null,
            'browser' => $validated['browser'] ?? null,
            'browser_version' => $validated['browser_version'] ?? null,
            'operating_system' => $validated['operating_system'] ?? null,
            'device_type' => $validated['device_type'] ?? null,
            'screen_resolution' => $validated['screen_resolution'] ?? null,
            'timezone' => $validated['timezone'] ?? null,
            'ip_address' => $request->ip(),
            'metadata' => $metadata,
            'captured_at' => $capturedAt,
        ]);

        return response()->json($this->serializeRecord($record->load('user:id,full_name,name,email')), 201);
    }

    private function isAttendanceEnabled(): bool
    {
        $settings = DB::table('app_settings')->first();

        if (! $settings) {
            return true;
        }

        $attendance = AttendanceWatermarkSettings::normalizeConfig((array) $settings);

        return (bool) $attendance['enabled'];
    }

    public function dashboard(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'type' => ['nullable', 'in:clock_in,clock_out'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $query = AttendanceRecord::query()
            ->with('user:id,full_name,name,email')
            ->orderByDesc('captured_at');

        $this->applyFilters($query, $validated);

        $limit = $validated['limit'] ?? 100;
        $records = $query->limit($limit)->get();

        $summaryQuery = AttendanceRecord::query();
        $this->applyFilters($summaryQuery, $validated);

        return response()->json([
            'records' => $records->map(fn (AttendanceRecord $record) => $this->serializeRecord($record))->values(),
            'summary' => [
                'total' => (clone $summaryQuery)->count(),
                'clock_ins' => (clone $summaryQuery)->where('type', 'clock_in')->count(),
                'clock_outs' => (clone $summaryQuery)->where('type', 'clock_out')->count(),
                'unique_users' => (clone $summaryQuery)->distinct('user_id')->count('user_id'),
            ],
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse|JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'type' => ['nullable', 'in:clock_in,clock_out'],
        ]);

        $query = AttendanceRecord::query()
            ->with('user:id,full_name,name,email')
            ->orderByDesc('captured_at');

        $this->applyFilters($query, $validated);

        $filename = 'attendance-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'ID',
                'User',
                'Email',
                'Type',
                'Captured At',
                'Location',
                'Latitude',
                'Longitude',
                'Browser',
                'Browser Version',
                'Operating System',
                'Device Type',
                'Screen Resolution',
                'Timezone',
                'IP Address',
                'Shift',
                'Worked Minutes',
                'Overtime Minutes',
                'Photo URL',
            ]);

            foreach ($query->lazy(500) as $record) {
                $photoUrl = $record->photo_url;
                if ($photoUrl && ! str_starts_with($photoUrl, 'http')) {
                    $photoUrl = url($photoUrl);
                }

                $policy = is_array($record->metadata['policy'] ?? null) ? $record->metadata['policy'] : [];

                fputcsv($handle, [
                    $record->id,
                    $record->user?->full_name ?: $record->user?->name,
                    $record->user?->email,
                    $record->type === 'clock_in' ? 'Clock In' : 'Clock Out',
                    $record->captured_at?->toISOString(),
                    $record->location_label,
                    $record->latitude,
                    $record->longitude,
                    $record->browser,
                    $record->browser_version,
                    $record->operating_system,
                    $record->device_type,
                    $record->screen_resolution,
                    $record->timezone,
                    $record->ip_address,
                    $policy['shift_name'] ?? null,
                    $policy['worked_minutes'] ?? null,
                    $policy['overtime_minutes'] ?? null,
                    $photoUrl,
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function userHistory(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = AttendanceRecord::query()
            ->where('user_id', $user->id)
            ->orderByDesc('captured_at');

        if (! empty($validated['date_from'])) {
            $query->where('captured_at', '>=', Carbon::parse($validated['date_from'])->startOfDay());
        }

        if (! empty($validated['date_to'])) {
            $query->where('captured_at', '<=', Carbon::parse($validated['date_to'])->endOfDay());
        }

        $limit = $validated['limit'] ?? 50;
        $records = $query->limit($limit)->get();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'full_name' => $user->full_name,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'records' => $records->map(fn (AttendanceRecord $record) => $this->serializeRecord($record))->values(),
        ]);
    }

    /** @param Builder<AttendanceRecord> $query */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['date_from'])) {
            $query->where('captured_at', '>=', Carbon::parse($filters['date_from'])->startOfDay());
        }

        if (! empty($filters['date_to'])) {
            $query->where('captured_at', '<=', Carbon::parse($filters['date_to'])->endOfDay());
        }

        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (! empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }
    }

    private function resolveNextType(?AttendanceRecord $lastRecord): string
    {
        if (! $lastRecord || $lastRecord->type === 'clock_out') {
            return 'clock_in';
        }

        return 'clock_out';
    }

    private function serializeRecord(AttendanceRecord $record): array
    {
        $payload = $record->toArray();

        if ($record->relationLoaded('user') && $record->user) {
            $payload['user'] = [
                'id' => $record->user->id,
                'full_name' => $record->user->full_name,
                'name' => $record->user->name,
                'email' => $record->user->email,
            ];
        }

        $payload['captured_at'] = $record->captured_at?->toISOString();

        return $payload;
    }

    private function authorizeUser(Request $request): ?JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return null;
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }

    /** @param array<string, mixed> $address */
    private function formatAddressLabel(array $address, string $displayName): ?string
    {
        $street = $address['road']
            ?? $address['pedestrian']
            ?? $address['footway']
            ?? $address['path']
            ?? $address['cycleway']
            ?? $address['residential']
            ?? null;

        $area = $address['suburb']
            ?? $address['neighbourhood']
            ?? $address['quarter']
            ?? $address['district']
            ?? null;

        $city = $address['city']
            ?? $address['town']
            ?? $address['village']
            ?? $address['municipality']
            ?? $address['county']
            ?? null;

        $parts = array_values(array_filter([$street, $area, $city]));

        if ($parts) {
            return implode(', ', $parts);
        }

        if ($displayName) {
            return trim(implode(', ', array_slice(explode(',', $displayName), 0, 3)));
        }

        return null;
    }
}
