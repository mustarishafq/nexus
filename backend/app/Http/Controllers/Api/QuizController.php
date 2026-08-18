<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuizController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $scope = $request->string('scope')->toString() ?: 'mine';

        $query = Quiz::query()->withCount('questions')->with('owner:id,name,full_name,email');

        if ($scope === 'published') {
            $query->where('status', Quiz::STATUS_PUBLISHED);
        } elseif ($scope === 'all' && $user->role === 'admin') {
            // admins see everything
        } else {
            $query->where('user_id', $user->id);
        }

        $items = $query->orderByDesc('updated_at')->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in([Quiz::STATUS_DRAFT, Quiz::STATUS_PUBLISHED])],
            'bgm_theme' => ['sometimes', Rule::in(Quiz::BGM_THEMES)],
            'sfx_pack' => ['sometimes', Rule::in(Quiz::SFX_PACKS)],
            'questions' => ['sometimes', 'array'],
            'questions.*.prompt' => ['required_with:questions', 'string', 'max:2000'],
            'questions.*.time_limit_seconds' => ['sometimes', 'integer', 'min:5', 'max:120'],
            'questions.*.points_base' => ['sometimes', 'integer', 'min:100', 'max:5000'],
            'questions.*.options' => ['required_with:questions', 'array', 'min:2', 'max:4'],
            'questions.*.options.*.label' => ['required', 'string', 'max:500'],
            'questions.*.options.*.is_correct' => ['required', 'boolean'],
        ]);

        $quiz = DB::transaction(function () use ($validated, $user) {
            $quiz = Quiz::create([
                'user_id' => $user->id,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'status' => $validated['status'] ?? Quiz::STATUS_DRAFT,
                'bgm_theme' => $validated['bgm_theme'] ?? 'party',
                'sfx_pack' => $validated['sfx_pack'] ?? 'soft',
            ]);

            if (! empty($validated['questions'])) {
                $this->syncQuestions($quiz, $validated['questions']);
            }

            return $quiz;
        });

        return response()->json($quiz->load(['questions.options', 'owner:id,name,full_name,email']), 201);
    }

    public function show(Request $request, Quiz $quiz): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->canViewQuiz($user, $quiz)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($quiz->load(['questions.options', 'owner:id,name,full_name,email']));
    }

    public function update(Request $request, Quiz $quiz): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->canEditQuiz($user, $quiz)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in([Quiz::STATUS_DRAFT, Quiz::STATUS_PUBLISHED])],
            'bgm_theme' => ['sometimes', Rule::in(Quiz::BGM_THEMES)],
            'sfx_pack' => ['sometimes', Rule::in(Quiz::SFX_PACKS)],
            'questions' => ['sometimes', 'array'],
            'questions.*.prompt' => ['required_with:questions', 'string', 'max:2000'],
            'questions.*.time_limit_seconds' => ['sometimes', 'integer', 'min:5', 'max:120'],
            'questions.*.points_base' => ['sometimes', 'integer', 'min:100', 'max:5000'],
            'questions.*.options' => ['required_with:questions', 'array', 'min:2', 'max:4'],
            'questions.*.options.*.label' => ['required', 'string', 'max:500'],
            'questions.*.options.*.is_correct' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($quiz, $validated) {
            $quiz->fill(collect($validated)->only(['title', 'description', 'status', 'bgm_theme', 'sfx_pack'])->all());
            $quiz->save();

            if (array_key_exists('questions', $validated)) {
                $quiz->questions()->each(function (QuizQuestion $question) {
                    $question->options()->delete();
                    $question->delete();
                });
                $this->syncQuestions($quiz, $validated['questions']);
            }
        });

        return response()->json($quiz->fresh()->load(['questions.options', 'owner:id,name,full_name,email']));
    }

    public function destroy(Request $request, Quiz $quiz): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->canEditQuiz($user, $quiz)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $quiz->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function storeQuestion(Request $request, Quiz $quiz): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->canEditQuiz($user, $quiz)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:2000'],
            'time_limit_seconds' => ['sometimes', 'integer', 'min:5', 'max:120'],
            'points_base' => ['sometimes', 'integer', 'min:100', 'max:5000'],
            'options' => ['required', 'array', 'min:2', 'max:4'],
            'options.*.label' => ['required', 'string', 'max:500'],
            'options.*.is_correct' => ['required', 'boolean'],
        ]);

        $this->assertExactlyOneCorrect($validated['options']);

        $maxOrder = (int) $quiz->questions()->max('sort_order');

        $question = DB::transaction(function () use ($quiz, $validated, $maxOrder) {
            $question = QuizQuestion::create([
                'quiz_id' => $quiz->id,
                'prompt' => $validated['prompt'],
                'time_limit_seconds' => $validated['time_limit_seconds'] ?? 20,
                'points_base' => $validated['points_base'] ?? 1000,
                'sort_order' => $maxOrder + 1,
            ]);

            foreach (array_values($validated['options']) as $i => $option) {
                QuizOption::create([
                    'quiz_question_id' => $question->id,
                    'label' => $option['label'],
                    'is_correct' => (bool) $option['is_correct'],
                    'sort_order' => $i,
                ]);
            }

            return $question;
        });

        return response()->json($question->load('options'), 201);
    }

    public function updateQuestion(Request $request, Quiz $quiz, QuizQuestion $question): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->canEditQuiz($user, $quiz) || (int) $question->quiz_id !== (int) $quiz->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'prompt' => ['sometimes', 'string', 'max:2000'],
            'time_limit_seconds' => ['sometimes', 'integer', 'min:5', 'max:120'],
            'points_base' => ['sometimes', 'integer', 'min:100', 'max:5000'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'options' => ['sometimes', 'array', 'min:2', 'max:4'],
            'options.*.label' => ['required_with:options', 'string', 'max:500'],
            'options.*.is_correct' => ['required_with:options', 'boolean'],
        ]);

        DB::transaction(function () use ($question, $validated) {
            $question->fill(collect($validated)->only([
                'prompt', 'time_limit_seconds', 'points_base', 'sort_order',
            ])->all());
            $question->save();

            if (array_key_exists('options', $validated)) {
                $this->assertExactlyOneCorrect($validated['options']);
                $question->options()->delete();
                foreach (array_values($validated['options']) as $i => $option) {
                    QuizOption::create([
                        'quiz_question_id' => $question->id,
                        'label' => $option['label'],
                        'is_correct' => (bool) $option['is_correct'],
                        'sort_order' => $i,
                    ]);
                }
            }
        });

        return response()->json($question->fresh()->load('options'));
    }

    public function destroyQuestion(Request $request, Quiz $quiz, QuizQuestion $question): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->canEditQuiz($user, $quiz) || (int) $question->quiz_id !== (int) $quiz->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $question->options()->delete();
        $question->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function attempts(Request $request, Quiz $quiz): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! $this->canEditQuiz($user, $quiz)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $sessions = $quiz->sessions()
            ->where('mode', 'async')
            ->with(['players'])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn ($session) => [
                'id' => $session->id,
                'status' => $session->status,
                'created_at' => $session->created_at?->toIso8601String(),
                'player' => $session->players->first()?->only(['user_id', 'display_name', 'score', 'streak']),
            ]);

        return response()->json($sessions);
    }

    /**
     * @param  list<array{prompt: string, time_limit_seconds?: int, points_base?: int, options: list<array{label: string, is_correct: bool}>}>  $questions
     */
    protected function syncQuestions(Quiz $quiz, array $questions): void
    {
        foreach (array_values($questions) as $i => $payload) {
            $this->assertExactlyOneCorrect($payload['options']);

            $question = QuizQuestion::create([
                'quiz_id' => $quiz->id,
                'prompt' => $payload['prompt'],
                'time_limit_seconds' => $payload['time_limit_seconds'] ?? 20,
                'points_base' => $payload['points_base'] ?? 1000,
                'sort_order' => $i,
            ]);

            foreach (array_values($payload['options']) as $j => $option) {
                QuizOption::create([
                    'quiz_question_id' => $question->id,
                    'label' => $option['label'],
                    'is_correct' => (bool) $option['is_correct'],
                    'sort_order' => $j,
                ]);
            }
        }
    }

    /**
     * @param  list<array{is_correct: bool}>  $options
     */
    protected function assertExactlyOneCorrect(array $options): void
    {
        $correct = collect($options)->where('is_correct', true)->count();
        if ($correct !== 1) {
            throw ValidationException::withMessages([
                'options' => ['Each question must have exactly one correct option.'],
            ]);
        }
    }

    protected function canViewQuiz(User $user, Quiz $quiz): bool
    {
        return $this->canEditQuiz($user, $quiz) || $quiz->status === Quiz::STATUS_PUBLISHED;
    }

    protected function canEditQuiz(User $user, Quiz $quiz): bool
    {
        return (int) $quiz->user_id === (int) $user->id || $user->role === 'admin';
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
