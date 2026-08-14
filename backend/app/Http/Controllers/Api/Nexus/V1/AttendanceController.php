<?php

namespace App\Http\Controllers\Api\Nexus\V1;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\User;
use App\Services\GamificationService;
use App\Support\NexusSatelliteAuth;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $auth = NexusSatelliteAuth::authenticate($request, ['brain-attendance']);
        if ($auth instanceof JsonResponse) {
            return $auth;
        }

        $validated = $request->validate([
            'after_id' => ['sometimes', 'integer', 'min:0'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:500'],
            'captured_from' => ['sometimes', 'nullable', 'date'],
            'captured_to' => ['sometimes', 'nullable', 'date'],
        ]);

        $afterId = (int) ($validated['after_id'] ?? 0);
        $limit = (int) ($validated['limit'] ?? 200);

        $query = AttendanceRecord::query()
            ->with('user:id,email')
            ->where('id', '>', $afterId)
            ->orderBy('id');

        if (! empty($validated['captured_from'])) {
            $query->where('captured_at', '>=', Carbon::parse($validated['captured_from']));
        }

        if (! empty($validated['captured_to'])) {
            $query->where('captured_at', '<=', Carbon::parse($validated['captured_to']));
        }

        $records = $query->limit($limit + 1)->get();
        $hasMore = $records->count() > $limit;
        if ($hasMore) {
            $records = $records->take($limit);
        }

        $lastId = $records->last()?->id ?? $afterId;

        return response()->json([
            'records' => $records->map(fn (AttendanceRecord $record) => $this->serializeRecord($record))->values(),
            'pagination' => [
                'has_more' => $hasMore,
                'after_id' => (int) $lastId,
            ],
        ]);
    }

    public function ingest(Request $request): JsonResponse
    {
        $auth = NexusSatelliteAuth::authenticate($request, ['brain-attendance']);
        if ($auth instanceof JsonResponse) {
            return $auth;
        }

        $validated = $request->validate([
            'external_id' => ['required', 'string', 'max:128'],
            'nexus_user_id' => ['nullable', 'string', 'max:64'],
            'email' => ['required', 'email'],
            'type' => ['required', 'in:clock_in,clock_out'],
            'captured_at' => ['required', 'date'],
            'photo_url' => ['nullable', 'string', 'max:2048'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'location_label' => ['nullable', 'string', 'max:512'],
            'browser' => ['nullable', 'string', 'max:64'],
            'browser_version' => ['nullable', 'string', 'max:32'],
            'operating_system' => ['nullable', 'string', 'max:64'],
            'device_type' => ['nullable', 'string', 'max:32'],
            'screen_resolution' => ['nullable', 'string', 'max:32'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'metadata' => ['nullable', 'array'],
        ]);

        // De-duplicate: satellite punches (Insan; legacy rows may still say kashfi).
        $existing = AttendanceRecord::query()
            ->whereIn('source', ['insan', 'kashfi', 'resource'])
            ->where('external_id', $validated['external_id'])
            ->first();

        if ($existing) {
            return response()->json($this->serializeRecord($existing->load('user')));
        }

        $user = User::query()->where('email', strtolower($validated['email']))->first();
        if (! $user && ! empty($validated['nexus_user_id'])) {
            $user = User::query()->where('id', (int) $validated['nexus_user_id'])->first();
        }

        if (! $user) {
            return response()->json(['message' => 'User not found in Brain.'], 404);
        }

        $capturedAt = Carbon::parse($validated['captured_at']);

        $record = AttendanceRecord::create([
            'user_id' => $user->id,
            'type' => $validated['type'],
            'photo_url' => $validated['photo_url'] ?? null,
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
            'metadata' => $validated['metadata'] ?? null,
            'captured_at' => $capturedAt,
            'source' => 'insan',
            'external_id' => $validated['external_id'],
        ]);

        // Insan clocks must earn the same missions as Brain /attendance/clock.
        app(GamificationService::class)->offerForAttendanceRecord($user, $record);

        return response()->json($this->serializeRecord($record->load('user')), 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRecord(AttendanceRecord $record): array
    {
        return [
            'external_id' => (string) $record->id,
            'nexus_user_id' => $record->user_id ? (string) $record->user_id : null,
            'email' => $record->user?->email,
            'type' => $record->type,
            'captured_at' => $record->captured_at?->toIso8601String(),
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
    }
}
