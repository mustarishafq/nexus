<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\User;
use App\Services\QuizAnalyticsService;
use App\Services\PermissionService;
use App\Support\ApiTokenAuth;
use App\Support\PermissionCatalog;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuizController extends Controller
{
    public function __construct(
        protected QuizAnalyticsService $analytics,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $scope = $request->string('scope')->toString() ?: 'mine';

        $query = Quiz::query()->withCount('questions')->with('owner:id,name,full_name,email');

        if ($scope === 'published') {
            if (! PermissionService::canAccessGames($user)) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $query->where('status', Quiz::STATUS_PUBLISHED);
        } elseif ($scope === 'all' && PermissionService::can($user, PermissionCatalog::QUIZ_MANAGE)) {
            // admins see everything
        } else {
            if (! PermissionService::can($user, PermissionCatalog::QUIZ_CREATE)
                && ! PermissionService::can($user, PermissionCatalog::QUIZ_MANAGE_OWN)
                && ! PermissionService::can($user, PermissionCatalog::QUIZ_MANAGE)
            ) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $query->where('user_id', $user->id);
        }

        $items = $query->orderByDesc('updated_at')->get();

        if ($scope === 'published') {
            return response()->json($this->serializePublishedIndex($items, $user));
        }

        if ($scope !== 'all') {
            return response()->json($this->serializeMineIndex($items));
        }

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if (! PermissionService::can($user, PermissionCatalog::QUIZ_CREATE)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in([Quiz::STATUS_DRAFT, Quiz::STATUS_PUBLISHED])],
            'bgm_theme' => ['sometimes', Rule::in(Quiz::BGM_THEMES)],
            'sfx_pack' => ['sometimes', Rule::in(Quiz::SFX_PACKS)],
            'async_power_ups_enabled' => ['sometimes', 'boolean'],
            'async_deadline_at' => ['sometimes', 'nullable', 'date'],
            'questions' => ['sometimes', 'array'],
            'questions.*.prompt' => ['required_with:questions', 'string', 'max:2000'],
            'questions.*.image_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'questions.*.question_type' => ['sometimes', 'nullable', 'string', Rule::in(QuizQuestion::TYPES)],
            'questions.*.time_limit_seconds' => ['sometimes', 'integer', 'min:5', 'max:120'],
            'questions.*.points_base' => ['sometimes', 'integer', 'min:100', 'max:5000'],
            'questions.*.options' => ['required_with:questions', 'array', 'min:2', 'max:4'],
            'questions.*.options.*.label' => ['required', 'string', 'max:500'],
            'questions.*.options.*.is_correct' => ['required', 'boolean'],
        ]);

        if (! empty($validated['questions'])) {
            $validated['questions'] = $this->prepareQuestions($validated['questions']);
        }

        $this->assertPublishableQuestionSet($validated['questions'] ?? []);

        $status = $validated['status'] ?? Quiz::STATUS_DRAFT;

        $quiz = DB::transaction(function () use ($validated, $user, $status) {
            $quiz = Quiz::create(array_merge([
                'user_id' => $user->id,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'status' => $status,
                'bgm_theme' => $validated['bgm_theme'] ?? 'party',
                'sfx_pack' => $validated['sfx_pack'] ?? 'classic',
            ], $this->selfPacedAttributes($validated, $status, true)));

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

        if ($quiz->hasActiveLiveSession()) {
            return response()->json([
                'message' => 'This quiz has a live session in progress. End the game before editing.',
            ], 422);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in([Quiz::STATUS_DRAFT, Quiz::STATUS_PUBLISHED])],
            'bgm_theme' => ['sometimes', Rule::in(Quiz::BGM_THEMES)],
            'sfx_pack' => ['sometimes', Rule::in(Quiz::SFX_PACKS)],
            'async_power_ups_enabled' => ['sometimes', 'boolean'],
            'async_deadline_at' => ['sometimes', 'nullable', 'date'],
            'questions' => ['sometimes', 'array'],
            'questions.*.prompt' => ['required_with:questions', 'string', 'max:2000'],
            'questions.*.image_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'questions.*.question_type' => ['sometimes', 'nullable', 'string', Rule::in(QuizQuestion::TYPES)],
            'questions.*.time_limit_seconds' => ['sometimes', 'integer', 'min:5', 'max:120'],
            'questions.*.points_base' => ['sometimes', 'integer', 'min:100', 'max:5000'],
            'questions.*.options' => ['required_with:questions', 'array', 'min:2', 'max:4'],
            'questions.*.options.*.label' => ['required', 'string', 'max:500'],
            'questions.*.options.*.is_correct' => ['required', 'boolean'],
        ]);

        if (array_key_exists('questions', $validated)) {
            $validated['questions'] = $this->prepareQuestions($validated['questions']);
        }

        $questionPayload = $validated['questions'] ?? $this->questionPayloadFromQuiz($quiz);
        $this->assertPublishableQuestionSet($questionPayload);

        DB::transaction(function () use ($quiz, $validated) {
            $quiz->fill(collect($validated)->only(['title', 'description', 'status', 'bgm_theme', 'sfx_pack'])->all());
            $nextStatus = $validated['status'] ?? $quiz->status;
            $quiz->fill($this->selfPacedAttributes($validated, $nextStatus, false));
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

        $blocked = false;
        DB::transaction(function () use ($quiz, &$blocked) {
            $quiz->sessions()->lockForUpdate()->get();

            if ($quiz->hasActiveLiveSession()) {
                $blocked = true;

                return;
            }

            $quiz->delete();
        });

        if ($blocked) {
            return response()->json([
                'message' => 'This quiz cannot be deleted while a live game is in progress.',
            ], 422);
        }

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

        if ($quiz->hasActiveLiveSession()) {
            return response()->json([
                'message' => 'This quiz has a live session in progress. End the game before editing questions.',
            ], 422);
        }

        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:2000'],
            'image_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'question_type' => ['sometimes', 'nullable', 'string', Rule::in(QuizQuestion::TYPES)],
            'time_limit_seconds' => ['sometimes', 'integer', 'min:5', 'max:120'],
            'points_base' => ['sometimes', 'integer', 'min:100', 'max:5000'],
            'options' => ['required', 'array', 'min:2', 'max:4'],
            'options.*.label' => ['required', 'string', 'max:500'],
            'options.*.is_correct' => ['required', 'boolean'],
        ]);

        $prepared = $this->prepareQuestion($validated);
        $validated = array_merge($validated, $prepared);

        $this->assertExactlyOneCorrect($validated['options']);

        $pending = $this->questionPayloadFromQuiz($quiz);
        $pending[] = [
            'prompt' => $validated['prompt'],
            'image_url' => $this->normalizedImageUrl($validated['image_url'] ?? null),
            'question_type' => $this->normalizedQuestionType($validated['question_type'] ?? null),
            'options' => $validated['options'],
        ];
        $this->assertPublishableQuestionSet($pending);

        $maxOrder = (int) $quiz->questions()->max('sort_order');

        $question = DB::transaction(function () use ($quiz, $validated, $maxOrder) {
            $question = QuizQuestion::create([
                'quiz_id' => $quiz->id,
                'prompt' => $validated['prompt'],
                'image_url' => $this->normalizedImageUrl($validated['image_url'] ?? null),
                'question_type' => $this->normalizedQuestionType($validated['question_type'] ?? null),
                'time_limit_seconds' => $validated['time_limit_seconds'] ?? 20,
                'points_base' => $validated['points_base'] ?? 1000,
                'sort_order' => $maxOrder + 1,
            ]);

            foreach (array_values($validated['options']) as $i => $option) {
                QuizOption::create([
                    'quiz_question_id' => $question->id,
                    'label' => $option['label'],
                    'is_correct' => $this->optionIsCorrect($option),
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

        if ($quiz->hasActiveLiveSession()) {
            return response()->json([
                'message' => 'This quiz has a live session in progress. End the game before editing questions.',
            ], 422);
        }

        $validated = $request->validate([
            'prompt' => ['sometimes', 'string', 'max:2000'],
            'image_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'question_type' => ['sometimes', 'nullable', 'string', Rule::in(QuizQuestion::TYPES)],
            'time_limit_seconds' => ['sometimes', 'integer', 'min:5', 'max:120'],
            'points_base' => ['sometimes', 'integer', 'min:100', 'max:5000'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'options' => ['sometimes', 'array', 'min:2', 'max:4'],
            'options.*.label' => ['required_with:options', 'string', 'max:500'],
            'options.*.is_correct' => ['required_with:options', 'boolean'],
        ]);

        if (array_key_exists('question_type', $validated) || array_key_exists('options', $validated)) {
            $projectedType = array_key_exists('question_type', $validated)
                ? $this->normalizedQuestionType($validated['question_type'])
                : $this->normalizedQuestionType($question->question_type);
            $projectedOptions = $validated['options'] ?? $question->options->map(fn (QuizOption $option) => [
                'label' => $option->label,
                'is_correct' => (bool) $option->is_correct,
            ])->all();
            $prepared = $this->prepareQuestion([
                'question_type' => $projectedType,
                'options' => $projectedOptions,
            ]);
            $validated['question_type'] = $prepared['question_type'];
            if (array_key_exists('options', $validated) || QuizQuestion::isTrueFalse($projectedType)) {
                $validated['options'] = $prepared['options'];
            }
        }

        if (array_key_exists('options', $validated)) {
            $this->assertExactlyOneCorrect($validated['options']);
        }

        $this->assertPublishableQuestionSet(
            $this->projectedQuestionPayloadAfterUpdate($quiz, $question, $validated),
        );

        DB::transaction(function () use ($question, $validated) {
            $question->fill(collect($validated)->only([
                'prompt', 'time_limit_seconds', 'points_base', 'sort_order', 'question_type',
            ])->all());
            if (array_key_exists('question_type', $validated)) {
                $question->question_type = $this->normalizedQuestionType($validated['question_type']);
            }
            if (array_key_exists('image_url', $validated)) {
                $question->image_url = $this->normalizedImageUrl($validated['image_url']);
            }
            $question->save();

            if (array_key_exists('options', $validated)) {
                $question->options()->delete();
                foreach (array_values($validated['options']) as $i => $option) {
                    QuizOption::create([
                        'quiz_question_id' => $question->id,
                        'label' => $option['label'],
                        'is_correct' => $this->optionIsCorrect($option),
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

        if ($quiz->hasActiveLiveSession()) {
            return response()->json([
                'message' => 'This quiz has a live session in progress. End the game before editing questions.',
            ], 422);
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
            ->selfPaced()
            ->with(['players'])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn ($session) => [
                'id' => $session->id,
                'status' => $session->status,
                'created_at' => $session->created_at?->toIso8601String(),
                'finished_at' => $session->finished_at?->toIso8601String()
                    ?? ($session->status === QuizSession::STATUS_FINISHED ? $session->updated_at?->toIso8601String() : null),
                'player' => $session->players->first()?->only(['user_id', 'display_name', 'score', 'streak']),
            ]);

        return response()->json($sessions);
    }

    public function history(Request $request, Quiz $quiz): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        try {
            return response()->json($this->analytics->historyForQuiz($quiz, $user));
        } catch (AuthorizationException $e) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
    }

    public function selfPacedAnalytics(Request $request, Quiz $quiz): JsonResponse
    {
        $user = $this->requireApprovedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        try {
            return response()->json($this->analytics->selfPacedForQuiz($quiz, $user));
        } catch (AuthorizationException $e) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Quiz>  $items
     * @return list<array<string, mixed>>
     */
    protected function serializeMineIndex($items): array
    {
        $quizIds = $items->pluck('id');
        $liveByQuiz = QuizSession::query()
            ->whereIn('quiz_id', $quizIds)
            ->where('mode', QuizSession::MODE_LIVE)
            ->with(['host:id,name,full_name', 'players'])
            ->withCount('players')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('quiz_id');

        $asyncByQuiz = QuizSession::query()
            ->whereIn('quiz_id', $quizIds)
            ->selfPaced()
            ->get(['id', 'quiz_id', 'status'])
            ->groupBy('quiz_id');

        return $items->map(function (Quiz $quiz) use ($liveByQuiz, $asyncByQuiz) {
            $live = ($liveByQuiz->get($quiz->id) ?? collect())->all();
            $async = $asyncByQuiz->get($quiz->id) ?? collect();

            return array_merge($quiz->toArray(), $this->analytics->serializeMineIndexExtras(
                $quiz,
                $live,
                $async->where('status', QuizSession::STATUS_FINISHED)->count(),
                $async->where('status', '!=', QuizSession::STATUS_FINISHED)->count(),
            ));
        })->all();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Quiz>  $items
     * @return list<array<string, mixed>>
     */
    protected function serializePublishedIndex($items, User $user): array
    {
        $quizIds = $items->pluck('id');
        $attempts = QuizSession::query()
            ->whereIn('quiz_id', $quizIds)
            ->selfPaced()
            ->whereHas('players', fn ($query) => $query->where('user_id', $user->id))
            ->orderByDesc('id')
            ->get()
            ->groupBy('quiz_id');

        return $items->map(function (Quiz $quiz) use ($attempts) {
            $mine = $attempts->get($quiz->id) ?? collect();
            $finished = $mine->firstWhere('status', QuizSession::STATUS_FINISHED);
            $latest = $finished ?: $mine->first();

            return array_merge($quiz->toArray(), [
                'viewer_attempt' => $this->analytics->serializeViewerAttempt($latest),
            ]);
        })->all();
    }

    /**
     * @param  list<array<string, mixed>>  $questions
     * @return list<array<string, mixed>>
     */
    protected function prepareQuestions(array $questions): array
    {
        return array_map(fn (array $question) => $this->prepareQuestion($question), array_values($questions));
    }

    /**
     * @param  array<string, mixed>  $question
     * @return array<string, mixed>
     */
    protected function prepareQuestion(array $question): array
    {
        $question['question_type'] = $this->normalizedQuestionType($question['question_type'] ?? null);

        if (array_key_exists('options', $question) && is_array($question['options'])) {
            if (QuizQuestion::isTrueFalse($question['question_type'])) {
                $question['options'] = $this->canonicalTrueFalseOptions($question['options']);
            }
            $this->assertExactlyOneCorrect($question['options']);
        }

        return $question;
    }

    /**
     * @param  list<array{label?: mixed, is_correct?: mixed}>  $options
     * @return list<array{label: string, is_correct: bool}>
     */
    protected function canonicalTrueFalseOptions(array $options): array
    {
        if (count($options) !== 2) {
            throw ValidationException::withMessages([
                'options' => ['True / False questions must have exactly two options: True and False.'],
            ]);
        }

        $normalized = [];
        foreach (array_values($options) as $option) {
            $label = $this->normalizeQuestionText((string) ($option['label'] ?? ''));
            if (! in_array($label, ['true', 'false'], true)) {
                throw ValidationException::withMessages([
                    'options' => ['True / False questions must use the labels True and False.'],
                ]);
            }
            if (isset($normalized[$label])) {
                throw ValidationException::withMessages([
                    'options' => ['True / False questions must have one True option and one False option.'],
                ]);
            }
            $normalized[$label] = $this->optionIsCorrect($option);
        }

        if (! isset($normalized['true'], $normalized['false'])) {
            throw ValidationException::withMessages([
                'options' => ['True / False questions must have one True option and one False option.'],
            ]);
        }

        return [
            ['label' => QuizQuestion::TRUE_LABEL, 'is_correct' => $normalized['true']],
            ['label' => QuizQuestion::FALSE_LABEL, 'is_correct' => $normalized['false']],
        ];
    }

    /**
     * @param  list<array{prompt: string, time_limit_seconds?: int, points_base?: int, options: list<array{label: string, is_correct: bool}>}>  $questions
     */
    protected function syncQuestions(Quiz $quiz, array $questions): void
    {
        foreach (array_values($questions) as $i => $payload) {
            $payload = $this->prepareQuestion($payload);
            $this->assertExactlyOneCorrect($payload['options']);

            $question = QuizQuestion::create([
                'quiz_id' => $quiz->id,
                'prompt' => $payload['prompt'],
                'image_url' => $this->normalizedImageUrl($payload['image_url'] ?? null),
                'question_type' => $this->normalizedQuestionType($payload['question_type'] ?? null),
                'time_limit_seconds' => $payload['time_limit_seconds'] ?? 20,
                'points_base' => $payload['points_base'] ?? 1000,
                'sort_order' => $i,
            ]);

            foreach (array_values($payload['options']) as $j => $option) {
                QuizOption::create([
                    'quiz_question_id' => $question->id,
                    'label' => $option['label'],
                    'is_correct' => $this->optionIsCorrect($option),
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
        $correct = collect($options)->filter(fn (array $option) => $this->optionIsCorrect($option))->count();
        if ($correct !== 1) {
            throw ValidationException::withMessages([
                'options' => ['Each question must have exactly one correct option.'],
            ]);
        }
    }

    /**
     * @param  list<array{prompt?: string, image_url?: ?string, options?: list<array{label: string, is_correct: bool}>}>  $questions
     */
    protected function assertPublishableQuestionSet(array $questions): void
    {
        $fingerprints = [];
        foreach (array_values($questions) as $index => $question) {
            $key = $this->questionContentFingerprint($question);
            if (isset($fingerprints[$key])) {
                $first = $fingerprints[$key] + 1;
                $second = $index + 1;
                throw ValidationException::withMessages([
                    'questions' => ["Questions {$first} and {$second} are identical. Change the prompt, an option, or the correct answer before saving."],
                ]);
            }
            $fingerprints[$key] = $index;
        }
    }

    /**
     * @param  array{prompt?: string, image_url?: ?string, options?: list<array{label: string, is_correct: bool}>}  $question
     */
    protected function questionContentFingerprint(array $question): string
    {
        $type = $this->normalizedQuestionType($question['question_type'] ?? null);
        $prompt = $this->normalizeQuestionText((string) ($question['prompt'] ?? ''));
        $image = $this->normalizedImageUrl($question['image_url'] ?? null) ?? '';
        $options = collect($question['options'] ?? [])
            ->values()
            ->map(function (array $option) {
                $label = $this->normalizeQuestionText((string) ($option['label'] ?? ''));
                $correct = $this->optionIsCorrect($option) ? '1' : '0';

                return $label.'|'.$correct;
            })
            ->implode("\n");

        return $type."\n".$prompt."\n".$image."\n".$options;
    }

    protected function normalizeQuestionText(string $value): string
    {
        $stripped = preg_replace('/[\x{00A0}\x{200B}\x{FEFF}]/u', ' ', $value) ?? $value;
        $collapsed = preg_replace('/\s+/u', ' ', trim($stripped)) ?? trim($stripped);

        return mb_strtolower($collapsed);
    }

    protected function normalizedQuestionType(mixed $type): string
    {
        if (! is_string($type) || trim($type) === '') {
            return QuizQuestion::TYPE_MULTIPLE_CHOICE;
        }

        return trim($type);
    }

    /**
     * @param  array{is_correct?: mixed}  $option
     */
    protected function optionIsCorrect(array $option): bool
    {
        $value = $option['is_correct'] ?? false;

        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            return (int) $value === 1;
        }

        if (is_string($value)) {
            $normalized = strtolower(trim($value));

            if (in_array($normalized, ['1', 'true', 'on', 'yes'], true)) {
                return true;
            }

            if (in_array($normalized, ['0', 'false', 'off', 'no', ''], true)) {
                return false;
            }
        }

        return (bool) filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    protected function normalizedImageUrl(mixed $url): ?string
    {
        return QuizQuestion::canonicalImageUrl($url);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return list<array{prompt: string, image_url: ?string, options: list<array{label: string, is_correct: mixed}>}>
     */
    protected function projectedQuestionPayloadAfterUpdate(Quiz $quiz, QuizQuestion $target, array $validated): array
    {
        $quiz->load('questions.options');

        return $quiz->questions->map(function (QuizQuestion $question) use ($target, $validated) {
            $payload = [
                'prompt' => $question->prompt,
                'image_url' => $question->image_url,
                'question_type' => $this->normalizedQuestionType($question->question_type),
                'options' => $question->options->map(fn (QuizOption $option) => [
                    'label' => $option->label,
                    'is_correct' => (bool) $option->is_correct,
                ])->all(),
            ];

            if ((int) $question->id !== (int) $target->id) {
                return $payload;
            }

            if (array_key_exists('prompt', $validated)) {
                $payload['prompt'] = $validated['prompt'];
            }
            if (array_key_exists('question_type', $validated)) {
                $payload['question_type'] = $this->normalizedQuestionType($validated['question_type']);
            }
            if (array_key_exists('image_url', $validated)) {
                $payload['image_url'] = $this->normalizedImageUrl($validated['image_url']);
            }
            if (array_key_exists('options', $validated)) {
                $payload['options'] = array_values($validated['options']);
            }

            return $payload;
        })->all();
    }

    /**
     * @return list<array{prompt: string, image_url: ?string, options: list<array{label: string, is_correct: bool}>}>
     */
    protected function questionPayloadFromQuiz(Quiz $quiz): array
    {
        return $quiz->questions()->with('options')->get()->map(function (QuizQuestion $question) {
            return [
                'prompt' => $question->prompt,
                'image_url' => $question->image_url,
                'question_type' => $this->normalizedQuestionType($question->question_type),
                'options' => $question->options->map(fn (QuizOption $option) => [
                    'label' => $option->label,
                    'is_correct' => (bool) $option->is_correct,
                ])->all(),
            ];
        })->all();
    }

    protected function canViewQuiz(User $user, Quiz $quiz): bool
    {
        if ($this->canEditQuiz($user, $quiz)) {
            return true;
        }

        return $quiz->status === Quiz::STATUS_PUBLISHED
            && PermissionService::canAccessGames($user);
    }

    /**
     * Drafts do not keep self-paced settings. Published quizzes may omit either field.
     *
     * @return array<string, mixed>
     */
    protected function selfPacedAttributes(array $validated, string $status, bool $creating): array
    {
        if ($status !== Quiz::STATUS_PUBLISHED) {
            return [
                'async_power_ups_enabled' => false,
                'async_deadline_at' => null,
            ];
        }

        $attrs = [];
        if ($creating || array_key_exists('async_power_ups_enabled', $validated)) {
            $attrs['async_power_ups_enabled'] = (bool) ($validated['async_power_ups_enabled'] ?? false);
        }
        if ($creating || array_key_exists('async_deadline_at', $validated)) {
            $attrs['async_deadline_at'] = $validated['async_deadline_at'] ?? null;
        }

        return $attrs;
    }

    protected function canEditQuiz(User $user, Quiz $quiz): bool
    {
        return PermissionService::canManageQuiz($user, $quiz);
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
