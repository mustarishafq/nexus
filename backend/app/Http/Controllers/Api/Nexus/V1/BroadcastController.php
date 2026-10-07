<?php

namespace App\Http\Controllers\Api\Nexus\V1;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Broadcast;
use App\Models\User;
use App\Support\NexusSatelliteAuth;
use App\Support\NotificationEventMapping;
use App\Support\SyncAssignmentRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Broadcasts an application raises for one person about one of its own records —
 * e.g. Insan's "you have a letter to sign and return". The application names the
 * record by its own reference: sending it again updates the same broadcast, and
 * resolving it takes the broadcast down. Until then it shows like any other.
 *
 * Only applications allowed to broadcast (Applications → Notifications) can
 * raise one; any application can always resolve its own.
 */
class BroadcastController extends Controller
{
    public function upsert(Request $request): JsonResponse
    {
        $application = NexusSatelliteAuth::authenticate($request, ['brain-broadcasts']);
        if ($application instanceof JsonResponse) {
            return $application;
        }

        if (! self::broadcastsEnabled($application)) {
            return response()->json([
                'message' => 'Broadcasts are turned off for this application in Nexus.',
                'code' => 'broadcasts_disabled',
            ], 403);
        }

        $validated = $request->validate([
            'ref' => ['required', 'string', 'max:120'],
            'nexus_user_id' => ['nullable', 'string', 'max:64'],
            'email' => ['nullable', 'email', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:5000'],
            'priority' => ['sometimes', 'in:low,medium,high,critical'],
            'action_url' => ['nullable', 'url', 'max:2048'],
            'action_label' => ['nullable', 'string', 'max:60'],
        ]);

        $recipient = $this->recipient($validated['nexus_user_id'] ?? null, $validated['email'] ?? null);
        if (! $recipient) {
            return response()->json([
                'message' => 'No Nexus user matches this person.',
                'code' => 'user_not_found',
            ], 422);
        }

        $broadcast = Broadcast::query()->firstOrNew([
            'application_id' => $application->id,
            'external_ref' => $validated['ref'],
        ]);
        $broadcast->fill([
            'title' => $validated['title'],
            'message' => $validated['message'] ?? null,
            'priority' => $validated['priority'] ?? 'medium',
            'action_url' => $validated['action_url'] ?? null,
            'action_label' => $validated['action_label'] ?? null,
            'audience_type' => Broadcast::AUDIENCE_INDIVIDUAL,
            'resolved_at' => null,
        ])->save();

        SyncAssignmentRecords::syncBroadcastUsers($broadcast, [$recipient->id]);

        return response()->json([
            'ok' => true,
            'broadcast_id' => $broadcast->id,
        ], $broadcast->wasRecentlyCreated ? 201 : 200);
    }

    public function resolve(Request $request): JsonResponse
    {
        $application = NexusSatelliteAuth::authenticate($request, ['brain-broadcasts']);
        if ($application instanceof JsonResponse) {
            return $application;
        }

        $validated = $request->validate([
            'ref' => ['required', 'string', 'max:120'],
        ]);

        $resolved = Broadcast::query()
            ->where('application_id', $application->id)
            ->where('external_ref', $validated['ref'])
            ->whereNull('resolved_at')
            ->update(['resolved_at' => now()]);

        // Nothing to resolve is fine: it was never raised, or is already down.
        return response()->json(['ok' => true, 'resolved' => $resolved > 0]);
    }

    public static function broadcastsEnabled(Application $application): bool
    {
        return (bool) NotificationEventMapping::normalize($application->notification_config)['broadcast_enabled'];
    }

    private function recipient(?string $nexusUserId, ?string $email): ?User
    {
        if ($nexusUserId !== null && ctype_digit($nexusUserId)) {
            $user = User::query()->find((int) $nexusUserId);
            if ($user) {
                return $user;
            }
        }

        if ($email === null || $email === '') {
            return null;
        }

        return User::query()->whereRaw('LOWER(email) = ?', [strtolower($email)])->first();
    }
}
