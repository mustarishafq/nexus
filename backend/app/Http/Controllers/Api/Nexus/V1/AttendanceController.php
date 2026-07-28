<?php

namespace App\Http\Controllers\Api\Nexus\V1;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
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
