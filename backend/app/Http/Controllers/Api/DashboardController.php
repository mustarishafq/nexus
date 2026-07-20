<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CelebrationWish;
use App\Models\Notification;
use App\Models\User;
use App\Services\PushNotificationService;
use App\Support\ApiTokenAuth;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class DashboardController extends Controller
{
    private const REACTIONS = ['🎉', '🎂', '👏', '🎈', '❤️', '🥳', '🙌'];

    public function celebrations(Request $request): JsonResponse
    {
        $anchor = $this->resolveCelebrationDate($request);
        $weekStart = $anchor->copy()->startOfWeek(Carbon::MONDAY);
        $weekEnd = $anchor->copy()->endOfWeek(Carbon::SUNDAY);
        $weekStartDate = $weekStart->toDateString();
        $weekEndDate = $weekEnd->toDateString();
        $currentUser = ApiTokenAuth::userFromRequest($request);
        $dayPairs = $this->monthDayPairsInRange($weekStart, $weekEnd);

        $birthdayUsers = User::query()
            ->where('is_approved', true)
            ->whereNotNull('date_of_birth')
            ->where(function (Builder $query) use ($dayPairs) {
                $this->applyMonthDayPairs($query, 'date_of_birth', $dayPairs);
            })
            ->orderBy('full_name')
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture', 'date_of_birth']);

        $serviceUsers = User::query()
            ->where('is_approved', true)
            ->whereNotNull('joined_at')
            ->where(function (Builder $query) use ($dayPairs) {
                $this->applyMonthDayPairs($query, 'joined_at', $dayPairs);
            })
            ->whereDate('joined_at', '<', $weekStartDate)
            ->orderBy('full_name')
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture', 'joined_at'])
            ->filter(function (User $user) use ($weekStart, $weekEnd) {
                $celebrationDate = $this->matchDateInRange($weekStart, $weekEnd, $user->joined_at->month, $user->joined_at->day);

                return $celebrationDate && ($celebrationDate->year - $user->joined_at->year) >= 1;
            })
            ->values();

        $recipientIds = $birthdayUsers->pluck('id')
            ->merge($serviceUsers->pluck('id'))
            ->unique()
            ->values()
            ->all();

        $wishesByKey = $this->loadWishesForWeek($weekStartDate, $weekEndDate, $recipientIds);

        $birthdays = $birthdayUsers->map(function (User $user) use ($weekStart, $weekEnd, $currentUser, $wishesByKey) {
            $celebrationDate = $this->matchDateInRange(
                $weekStart,
                $weekEnd,
                $user->date_of_birth->month,
                $user->date_of_birth->day
            );
            $celebrationDateString = $celebrationDate?->toDateString();

            return array_merge(
                [
                    'id' => $user->id,
                    'name' => $user->displayName(),
                    'email' => $user->email,
                    'profile_picture' => $user->profile_picture,
                    'date_of_birth' => $user->date_of_birth?->toDateString(),
                    'celebration_date' => $celebrationDateString,
                ],
                $this->wishSummary($user->id, 'birthday', $celebrationDateString, $currentUser, $wishesByKey)
            );
        })
            ->filter(fn (array $person) => filled($person['celebration_date'] ?? null))
            ->sortBy([
                ['celebration_date', 'asc'],
                ['name', 'asc'],
            ])
            ->values();

        $serviceAnniversaries = $serviceUsers->map(function (User $user) use ($weekStart, $weekEnd, $currentUser, $wishesByKey) {
            $celebrationDate = $this->matchDateInRange(
                $weekStart,
                $weekEnd,
                $user->joined_at->month,
                $user->joined_at->day
            );
            $celebrationDateString = $celebrationDate?->toDateString();
            $years = $celebrationDate
                ? $celebrationDate->year - $user->joined_at->year
                : null;

            return array_merge(
                [
                    'id' => $user->id,
                    'name' => $user->displayName(),
                    'email' => $user->email,
                    'profile_picture' => $user->profile_picture,
                    'joined_at' => $user->joined_at?->toDateString(),
                    'years_of_service' => $years,
                    'celebration_date' => $celebrationDateString,
                ],
                $this->wishSummary($user->id, 'service_anniversary', $celebrationDateString, $currentUser, $wishesByKey)
            );
        })
            ->filter(fn (array $person) => filled($person['celebration_date'] ?? null))
            ->sortBy([
                ['celebration_date', 'asc'],
                ['name', 'asc'],
            ])
            ->values();

        return response()->json([
            'date' => $anchor->toDateString(),
            'week_start' => $weekStartDate,
            'week_end' => $weekEndDate,
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

        if ($wish->wasRecentlyCreated || $wish->wasChanged('reaction')) {
            $this->notifyRecipientOfReaction($recipient, $sender, $validated['celebration_type'], $wish->reaction);
        }

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
     * @return list<array{0: int, 1: int}>
     */
    private function monthDayPairsInRange(Carbon $start, Carbon $end): array
    {
        $pairs = [];

        for ($day = $start->copy(); $day->lte($end); $day->addDay()) {
            $pairs[] = [$day->month, $day->day];
        }

        return $pairs;
    }

    /**
     * @param  list<array{0: int, 1: int}>  $dayPairs
     */
    private function applyMonthDayPairs(Builder $query, string $column, array $dayPairs): void
    {
        foreach ($dayPairs as [$month, $day]) {
            $query->orWhere(function (Builder $inner) use ($column, $month, $day) {
                $inner->whereMonth($column, $month)->whereDay($column, $day);
            });
        }
    }

    private function matchDateInRange(Carbon $start, Carbon $end, int $month, int $day): ?Carbon
    {
        for ($cursor = $start->copy(); $cursor->lte($end); $cursor->addDay()) {
            if ($cursor->month === $month && $cursor->day === $day) {
                return $cursor->copy()->startOfDay();
            }
        }

        return null;
    }

    /**
     * @param  array<int>  $recipientIds
     * @return Collection<string, Collection<int, CelebrationWish>>
     */
    private function loadWishesForWeek(string $weekStartDate, string $weekEndDate, array $recipientIds): Collection
    {
        if ($recipientIds === []) {
            return collect();
        }

        return CelebrationWish::query()
            ->whereBetween('celebration_date', [$weekStartDate, $weekEndDate])
            ->whereIn('recipient_user_id', $recipientIds)
            ->get()
            ->groupBy(fn (CelebrationWish $wish) => "{$wish->recipient_user_id}:{$wish->celebration_type}:{$wish->celebration_date->toDateString()}");
    }

    /**
     * @param  Collection<string, Collection<int, CelebrationWish>>  $wishesByKey
     * @return array<string, mixed>
     */
    private function wishSummary(
        int $recipientId,
        string $celebrationType,
        ?string $celebrationDate,
        ?User $currentUser,
        Collection $wishesByKey
    ): array {
        $wishes = $celebrationDate
            ? $wishesByKey->get("{$recipientId}:{$celebrationType}:{$celebrationDate}", collect())
            : collect();

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

    private function notifyRecipientOfReaction(
        User $recipient,
        User $sender,
        string $celebrationType,
        string $reaction
    ): void {
        $senderName = $sender->displayName();
        $isBirthday = $celebrationType === 'birthday';
        $occasion = $isBirthday ? 'birthday' : 'work anniversary';

        $notification = Notification::create([
            'user_id' => (string) $recipient->id,
            'type' => 'info',
            'priority' => 'medium',
            'title' => "{$senderName} reacted to your {$occasion}",
            'message' => "{$senderName} sent {$reaction} for your {$occasion}.",
            'category' => 'hr',
            'is_read' => false,
            'is_broadcast' => false,
            'action_url' => '/',
            'delivery_channels' => ['in_app'],
            'data' => [
                'kind' => 'celebration_reaction',
                'celebration_type' => $celebrationType,
                'reaction' => $reaction,
                'sender_user_id' => $sender->id,
            ],
        ]);

        app(PushNotificationService::class)->sendNotification($notification);
    }
}
