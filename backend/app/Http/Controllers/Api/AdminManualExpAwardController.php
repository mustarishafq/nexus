<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AdminNotificationService;
use App\Services\GamificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminManualExpAwardController extends Controller
{
    use AuthorizesRoles;

    public function __construct(
        private GamificationService $gamification,
    ) {}

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $limit = (int) $request->integer('limit', 30);

        return response()->json([
            'batches' => $this->gamification->listManualAwardBatches($limit),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'amount' => ['required', 'integer', 'min:1', 'max:5000'],
            'title' => ['required', 'string', 'max:120'],
            'reason' => ['nullable', 'string', 'max:500'],
            'notify' => ['sometimes', 'boolean'],
        ]);

        $awarder = $this->authenticatedUser($request);
        $uniqueIds = collect($validated['user_ids'])
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        $users = User::query()
            ->whereIn('id', $uniqueIds)
            ->get()
            ->keyBy('id');

        $eligible = [];
        $skipped = [];

        foreach ($uniqueIds as $userId) {
            $user = $users->get($userId);

            if (! $user) {
                $skipped[] = [
                    'user_id' => $userId,
                    'reason' => 'User not found.',
                ];
                continue;
            }

            if ($user->trashed()) {
                $skipped[] = [
                    'user_id' => $userId,
                    'email' => $user->email,
                    'reason' => 'User is deleted.',
                ];
                continue;
            }

            if (! $user->is_approved) {
                $skipped[] = [
                    'user_id' => $userId,
                    'email' => $user->email,
                    'reason' => 'User is not approved.',
                ];
                continue;
            }

            $eligible[] = $user;
        }

        if ($eligible === []) {
            return response()->json([
                'message' => 'No eligible users to award.',
                'awarded' => 0,
                'batch_id' => null,
                'rewards' => [],
                'skipped' => $skipped,
            ], 422);
        }

        $title = trim($validated['title']);
        $reason = isset($validated['reason']) ? trim((string) $validated['reason']) : null;
        if ($reason === '') {
            $reason = null;
        }
        $amount = (int) $validated['amount'];
        $notify = (bool) ($validated['notify'] ?? true);

        $result = $this->gamification->offerManualBatch(
            $eligible,
            $amount,
            $title,
            $awarder,
            $reason,
        );

        $rewards = collect($result['rewards'])
            ->map(fn ($reward) => $this->gamification->serializeReward($reward))
            ->values()
            ->all();

        $notification = null;
        if ($notify) {
            $message = $reason ?: $title;
            $notification = app(AdminNotificationService::class)->sendToUsers(
                $awarder,
                array_map(fn (User $user) => $user->id, $eligible),
                "You earned {$amount} EXP",
                $message,
                true,
                true,
                'success',
                'medium',
                '/missions',
            );
        }

        $awardedCount = count($rewards);

        return response()->json([
            'message' => "Awarded {$amount} EXP to {$awardedCount} user(s).",
            'awarded' => $awardedCount,
            'batch_id' => $result['batch_id'],
            'amount' => $amount,
            'title' => $title,
            'rewards' => $rewards,
            'skipped' => $skipped,
            'notification' => $notification,
        ]);
    }
}
