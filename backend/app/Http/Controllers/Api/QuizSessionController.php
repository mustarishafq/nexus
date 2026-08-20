<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\QuizSession;
use App\Models\QuizSessionPowerUp;
use App\Models\User;
use App\Services\QuizAnalyticsService;
use App\Services\QuizGameService;
use App\Support\ApiTokenAuth;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QuizSessionController extends Controller
{
    public function __construct(
        protected QuizGameService $game,
        protected QuizAnalyticsService $analytics,
    ) {}

    public function store(Request $request, Quiz $quiz): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'mode' => ['sometimes', Rule::in([QuizSession::MODE_LIVE, QuizSession::MODE_ASYNC])],
        ]);

        $mode = $validated['mode'] ?? QuizSession::MODE_LIVE;

        if ($mode === QuizSession::MODE_ASYNC) {
            $session = $this->game->startAsyncAttempt($quiz, $user);

            return response()->json($this->game->serializeSession($session, $user), 201);
        }

        if ((int) $quiz->user_id !== (int) $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $session = $this->game->createLiveSession($quiz, $user);

        return response()->json($this->game->serializeSession($session, $user), 201);
    }

    public function join(Request $request): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'pin' => ['required', 'string', 'size:6'],
        ]);

        $session = $this->game->joinLiveSession($validated['pin'], $user);

        return response()->json($this->game->serializeSession($session, $user));
    }

    public function show(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->canAccessSession($quizSession, $user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $quizSession = $this->game->hydrateLiveSession($quizSession);

        if ((int) $quizSession->host_user_id === (int) $user->id) {
            $quizSession = $this->game->touchHostPresence($quizSession, $user);
        }

        return response()->json($this->game->serializeSession($quizSession, $user));
    }

    public function heartbeat(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $session = $this->game->touchHostPresence($quizSession, $user);

        return response()->json($this->game->serializeSession($session, $user));
    }

    public function start(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $session = $this->game->startSession($quizSession, $user);

        return response()->json($this->game->serializeSession($session, $user));
    }

    public function reveal(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $session = $this->game->revealQuestion($quizSession, $user);

        return response()->json($this->game->serializeSession($session, $user));
    }

    public function leaderboard(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $session = $this->game->showLeaderboard($quizSession, $user);

        return response()->json($this->game->serializeSession($session, $user));
    }

    public function next(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $session = $this->game->nextQuestion($quizSession, $user);

        return response()->json($this->game->serializeSession($session, $user));
    }

    public function end(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $session = $this->game->endSession($quizSession, $user);

        return response()->json($this->game->serializeSession($session, $user));
    }

    public function leave(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $session = $this->game->leaveLiveSession($quizSession, $user);

        return response()->json($this->game->serializeSession($session, $user));
    }

    public function answer(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'option_id' => ['required', 'integer'],
        ]);

        if ($quizSession->mode === QuizSession::MODE_ASYNC) {
            $result = $this->game->submitAsyncAnswer($quizSession, $user, (int) $validated['option_id']);
            $sessionPayload = $this->game->serializeSession($result['session'], $user);

            return response()->json([
                'answer' => $this->game->presentAnswer($result['answer'], $result['session'], $user),
                'player' => $this->playerFromPayload($sessionPayload, $user),
                'session' => $sessionPayload,
            ]);
        }

        $result = $this->game->submitAnswer($quizSession, $user, (int) $validated['option_id']);
        $fresh = $quizSession->fresh();
        $sessionPayload = $this->game->serializeSession($fresh, $user);

        return response()->json([
            'answer' => $this->game->presentAnswer($result['answer'], $fresh, $user),
            'player' => $this->playerFromPayload($sessionPayload, $user),
            'session' => $sessionPayload,
        ]);
    }

    public function powerUp(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'type' => ['required', Rule::in(QuizSessionPowerUp::TYPES)],
        ]);

        $result = $this->game->usePowerUp($quizSession, $user, $validated['type']);

        return response()->json([
            'power_up' => $result['power_up'],
            'erased_option_ids' => $result['erased_option_ids'],
            'session' => $this->game->serializeSession($quizSession->fresh(), $user),
        ]);
    }

    public function analytics(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        try {
            $payload = $this->analytics->forSession($quizSession, $user);
        } catch (AuthorizationException $e) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($payload);
    }

    public function music(Request $request, QuizSession $quizSession): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'music_enabled' => ['sometimes', 'boolean'],
            'bgm_theme' => ['sometimes', Rule::in(Quiz::BGM_THEMES)],
            'sfx_pack' => ['sometimes', Rule::in(Quiz::SFX_PACKS)],
        ]);

        $settings = [
            'bgm_theme' => $validated['bgm_theme'] ?? null,
            'sfx_pack' => $validated['sfx_pack'] ?? null,
        ];

        if (array_key_exists('enabled', $validated)) {
            $settings['music_enabled'] = (bool) $validated['enabled'];
        }
        if (array_key_exists('music_enabled', $validated)) {
            $settings['music_enabled'] = (bool) $validated['music_enabled'];
        }

        $session = $this->game->setAudioSettings($quizSession, $user, $settings);

        return response()->json($this->game->serializeSession($session, $user));
    }

    public function showByToken(Request $request, string $token): JsonResponse
    {
        $session = QuizSession::query()
            ->where('join_token', $token)
            ->where('mode', QuizSession::MODE_LIVE)
            ->with(['quiz:id,title', 'host:id,name,full_name,email'])
            ->first();

        if (! $session || $session->status === QuizSession::STATUS_FINISHED) {
            return response()->json(['message' => 'Session not found'], 404);
        }

        $user = ApiTokenAuth::userFromRequest($request);

        return response()->json([
            'id' => $session->id,
            'pin' => $session->pin,
            'join_token' => $session->join_token,
            'status' => $session->status,
            'quiz_title' => $session->quiz?->title,
            'host_name' => $session->host?->displayName(),
            'player_count' => $session->players()->count(),
            'requires_auth' => true,
            'is_authenticated' => (bool) $user?->is_approved,
        ]);
    }

    protected function canAccessSession(QuizSession $session, User $user): bool
    {
        if ((int) $session->host_user_id === (int) $user->id) {
            return true;
        }

        return $session->players()->where('user_id', $user->id)->exists();
    }

    /**
     * @param  array<string, mixed>  $sessionPayload
     * @return array<string, mixed>|null
     */
    protected function playerFromPayload(array $sessionPayload, User $user): ?array
    {
        foreach ($sessionPayload['players'] ?? [] as $player) {
            if ((int) ($player['user_id'] ?? 0) === (int) $user->id) {
                return $player;
            }
        }

        return null;
    }

    protected function requireApprovedUser(Request $request): User|JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $user->is_approved) {
            return response()->json(['message' => 'Account not approved', 'code' => 'account_not_approved'], 403);
        }

        return $user;
    }
}
