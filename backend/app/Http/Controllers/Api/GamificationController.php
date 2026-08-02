<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpReward;
use App\Models\User;
use App\Services\AchievementService;
use App\Services\GamificationService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class GamificationController extends Controller
{
    public function __construct(
        protected GamificationService $gamification,
        protected AchievementService $achievements,
    ) {}

    public function me(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json($this->gamification->summary($user));
    }

    public function rewards(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:pending,claimed,expired'],
        ]);

        $rewards = $this->gamification->listRewards($user, $validated['status'] ?? null);

        return response()->json(
            $rewards->map(fn (ExpReward $reward) => $this->gamification->serializeReward($reward))->values()
        );
    }

    public function claim(Request $request, ExpReward $expReward): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $previousExp = (int) $user->exp_total;
        $previousRank = $this->gamification->expProgressPayload($user)['rank'];

        try {
            $claimed = $this->gamification->claim($user, $expReward);
        } catch (RuntimeException $e) {
            $status = $e->getMessage() === 'Forbidden' ? 403 : 422;

            return response()->json(['message' => $e->getMessage()], $status);
        }

        $outcome = $this->gamification->claimOutcome($user, $previousExp, $previousRank, collect([$claimed]));
        $newBadges = $this->achievements->evaluateAfterClaim($user, $outcome, collect([$claimed]));

        return response()->json(array_merge([
            'reward' => $this->gamification->serializeReward($claimed),
            'new_badges' => $newBadges,
        ], $outcome));
    }

    public function claimAll(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $previousExp = (int) $user->exp_total;
        $previousRank = $this->gamification->expProgressPayload($user)['rank'];

        $result = $this->gamification->claimAll($user);
        $outcome = $this->gamification->claimOutcome($user, $previousExp, $previousRank, $result['rewards']);
        $newBadges = ($result['claimed_count'] ?? 0) > 0
            ? $this->achievements->evaluateAfterClaim($user, $outcome, $result['rewards'])
            : [];

        return response()->json(array_merge([
            'claimed_count' => $result['claimed_count'],
            'claimed_amount' => $result['claimed_amount'],
            'rewards' => $result['rewards']
                ->map(fn (ExpReward $reward) => $this->gamification->serializeReward($reward))
                ->values(),
            'new_badges' => $newBadges,
        ], $outcome));
    }

    public function leaderboard(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'period' => ['nullable', 'string', 'in:week,month,all'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $period = $validated['period'] ?? 'all';
        $limit = (int) ($validated['limit'] ?? 50);

        return response()->json([
            'period' => $period,
            'entries' => $this->gamification->leaderboard($period, $limit)->values(),
            'viewer' => [
                'user_id' => $user->id,
                'exp_total' => (int) $user->exp_total,
            ],
        ]);
    }

    public function missions(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json($this->gamification->missions($user));
    }

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }
}
