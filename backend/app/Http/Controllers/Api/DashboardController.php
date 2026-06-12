<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CelebrationWish;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class DashboardController extends Controller
{
    private const REACTIONS = ['🎉', '🎂', '👏', '🎈', '❤️', '🥳', '🙌'];

    public function celebrations(Request $request): JsonResponse
    {
        $today = $this->resolveCelebrationDate($request);
        $month = $today->month;
        $day = $today->day;
        $todayDate = $today->toDateString();
        $currentUser = ApiTokenAuth::userFromRequest($request);

        $birthdayUsers = User::query()
            ->where('is_approved', true)
            ->whereNotNull('date_of_birth')
            ->whereMonth('date_of_birth', $month)
            ->whereDay('date_of_birth', $day)
            ->orderBy('full_name')
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture', 'date_of_birth']);

        $serviceUsers = User::query()
            ->where('is_approved', true)
            ->whereNotNull('joined_at')
            ->whereMonth('joined_at', $month)
            ->whereDay('joined_at', $day)
            ->whereDate('joined_at', '<', $todayDate)
            ->orderBy('full_name')
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture', 'joined_at'])
            ->filter(function (User $user) use ($today) {
                return ($today->year - $user->joined_at->year) >= 1;
            })
            ->values();

        $recipientIds = $birthdayUsers->pluck('id')
            ->merge($serviceUsers->pluck('id'))
            ->unique()
            ->values()
            ->all();

        $wishesByKey = $this->loadWishesForDate($todayDate, $recipientIds);

        $birthdays = $birthdayUsers->map(function (User $user) use ($today, $todayDate, $currentUser, $wishesByKey) {
            return array_merge(
                [
                    'id' => $user->id,
                    'name' => $user->displayName(),
                    'email' => $user->email,
                    'profile_picture' => $user->profile_picture,
                    'date_of_birth' => $user->date_of_birth?->toDateString(),
                    'age' => $user->date_of_birth ? $today->year - $user->date_of_birth->year : null,
                ],
                $this->wishSummary($user->id, 'birthday', $todayDate, $currentUser, $wishesByKey)
            );
        })->values();

        $serviceAnniversaries = $serviceUsers->map(function (User $user) use ($today, $todayDate, $currentUser, $wishesByKey) {
            return array_merge(
                [
                    'id' => $user->id,
                    'name' => $user->displayName(),
                    'email' => $user->email,
                    'profile_picture' => $user->profile_picture,
                    'joined_at' => $user->joined_at?->toDateString(),
                    'years_of_service' => $today->year - $user->joined_at->year,
                ],
                $this->wishSummary($user->id, 'service_anniversary', $todayDate, $currentUser, $wishesByKey)
            );
        })->values();

        return response()->json([
            'date' => $todayDate,
            'reactions' => self::REACTIONS,
            'birthdays' => $birthdays,
            'service_anniversaries' => $serviceAnniversaries,
        ]);
    }

    public function storeWish(Request $request): JsonResponse
    {
        $sender = ApiTokenAuth::userFromRequest($request);

        if (! $sender || ! $sender->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'recipient_user_id' => ['required', 'integer', 'exists:users,id'],
            'celebration_type' => ['required', Rule::in(['birthday', 'service_anniversary'])],
            'celebration_date' => ['required', 'date'],
            'reaction' => ['required', 'string', Rule::in(self::REACTIONS)],
        ]);

        if ((int) $validated['recipient_user_id'] === $sender->id) {
            return response()->json(['message' => 'You cannot react to yourself.'], 422);
        }

        $recipient = User::query()
            ->where('is_approved', true)
            ->find($validated['recipient_user_id']);

        if (! $recipient) {
            return response()->json(['message' => 'Recipient not found.'], 404);
        }

        $celebrationDate = Carbon::parse($validated['celebration_date'])->toDateString();

        if (! $this->recipientHasCelebration($recipient, $validated['celebration_type'], $celebrationDate)) {
            return response()->json(['message' => 'This celebration is not active for the selected date.'], 422);
        }

        $wish = CelebrationWish::query()->updateOrCreate(
            [
                'recipient_user_id' => $recipient->id,
                'sender_user_id' => $sender->id,
                'celebration_type' => $validated['celebration_type'],
                'celebration_date' => $celebrationDate,
            ],
            [
                'reaction' => $validated['reaction'],
                'message' => null,
            ]
        );

        return response()->json([
            'reaction' => [
                'id' => $wish->id,
                'reaction' => $wish->reaction,
            ],
        ], 201);
    }

    public function destroyWish(Request $request, CelebrationWish $celebrationWish): JsonResponse
    {
        $sender = ApiTokenAuth::userFromRequest($request);

        if (! $sender || ! $sender->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($celebrationWish->sender_user_id !== $sender->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $celebrationWish->delete();

        return response()->json(null, 204);
    }

    private function resolveCelebrationDate(Request $request): Carbon
    {
        return $request->filled('date')
            ? Carbon::parse($request->query('date'))->startOfDay()
            : now()->startOfDay();
    }

    /**
     * @param  array<int>  $recipientIds
     * @return Collection<string, Collection<int, CelebrationWish>>
     */
    private function loadWishesForDate(string $celebrationDate, array $recipientIds): Collection
    {
        if ($recipientIds === []) {
            return collect();
        }

        return CelebrationWish::query()
            ->where('celebration_date', $celebrationDate)
            ->whereIn('recipient_user_id', $recipientIds)
            ->get()
            ->groupBy(fn (CelebrationWish $wish) => "{$wish->recipient_user_id}:{$wish->celebration_type}");
    }

    /**
     * @param  Collection<string, Collection<int, CelebrationWish>>  $wishesByKey
     * @return array<string, mixed>
     */
    private function wishSummary(
        int $recipientId,
        string $celebrationType,
        string $celebrationDate,
        ?User $currentUser,
        Collection $wishesByKey
    ): array {
        $wishes = $wishesByKey->get("{$recipientId}:{$celebrationType}", collect());

        $reactionCounts = $wishes
            ->countBy('reaction')
            ->sortDesc()
            ->all();

        $myReaction = $currentUser
            ? $wishes->firstWhere('sender_user_id', $currentUser->id)
            : null;

        return [
            'reactions_count' => $wishes->count(),
            'reaction_counts' => $reactionCounts,
            'my_reaction' => $myReaction ? [
                'id' => $myReaction->id,
                'reaction' => $myReaction->reaction,
            ] : null,
            'can_react' => $currentUser && $currentUser->id !== $recipientId,
        ];
    }

    private function recipientHasCelebration(User $recipient, string $celebrationType, string $celebrationDate): bool
    {
        $date = Carbon::parse($celebrationDate)->startOfDay();

        if ($celebrationType === 'birthday') {
            if (! $recipient->date_of_birth) {
                return false;
            }

            return $recipient->date_of_birth->month === $date->month
                && $recipient->date_of_birth->day === $date->day;
        }

        if (! $recipient->joined_at) {
            return false;
        }

        if ($recipient->joined_at->toDateString() >= $celebrationDate) {
            return false;
        }

        return $recipient->joined_at->month === $date->month
            && $recipient->joined_at->day === $date->day
            && ($date->year - $recipient->joined_at->year) >= 1;
    }
}
