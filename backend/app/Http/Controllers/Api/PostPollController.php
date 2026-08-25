<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesPosts;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\PostPoll;
use App\Models\PostPollVote;
use App\Models\User;
use App\Services\GamificationService;
use App\Support\ApiTokenAuth;
use App\Support\PostPollPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PostPollController extends Controller
{
    use SerializesFeedAuthors;
    use SerializesPosts;

    public function vote(Request $request, Post $post, PostPoll $poll): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensurePollBelongsToPost($post, $poll)) {
            return $response;
        }

        if (! $post->isApproved()) {
            return response()->json(['message' => 'This post is awaiting approval.'], 422);
        }

        $poll->load('options');

        $validated = $request->validate([
            'option_id' => [
                'required',
                'integer',
                Rule::exists('post_poll_options', 'id')->where('post_poll_id', $poll->id),
            ],
        ]);

        $optionId = (int) $validated['option_id'];

        $existingVotes = PostPollVote::query()
            ->where('post_poll_id', $poll->id)
            ->where('user_id', $viewer->id)
            ->get();

        if ($poll->is_qna && $existingVotes->isNotEmpty()) {
            return response()->json([
                'message' => 'This question\'s vote cannot be changed.',
            ], 422);
        }

        $voted = DB::transaction(function () use ($poll, $viewer, $optionId, $existingVotes) {
            if ($poll->allow_multiple) {
                $existing = $existingVotes->firstWhere('post_poll_option_id', $optionId);

                if ($existing) {
                    $existing->delete();

                    return false;
                }

                PostPollVote::query()->create([
                    'post_poll_id' => $poll->id,
                    'user_id' => $viewer->id,
                    'post_poll_option_id' => $optionId,
                ]);

                return true;
            }

            $existing = $existingVotes->first();

            if ($existing && (int) $existing->post_poll_option_id === $optionId) {
                $existing->delete();

                return false;
            }

            PostPollVote::query()
                ->where('post_poll_id', $poll->id)
                ->where('user_id', $viewer->id)
                ->delete();

            PostPollVote::query()->create([
                'post_poll_id' => $poll->id,
                'user_id' => $viewer->id,
                'post_poll_option_id' => $optionId,
            ]);

            return true;
        });

        $payload = [
            'item' => $this->serializePost($this->reloadPost($post), $viewer),
        ];

        if ($voted) {
            $offer = app(GamificationService::class)->offer(
                $viewer,
                'feed_poll_vote',
                'post_poll',
                $poll->id.'-'.$viewer->id,
            );
            $payload = array_merge($payload, app(GamificationService::class)->offerPayload($offer));
        }

        return response()->json($payload);
    }

    public function addOption(Request $request, Post $post, PostPoll $poll): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensurePollBelongsToPost($post, $poll)) {
            return $response;
        }

        if (! $post->isApproved()) {
            return response()->json(['message' => 'This post is awaiting approval.'], 422);
        }

        $poll->load('options');

        if ($poll->is_qna || ! $poll->allow_add_options) {
            return response()->json(['message' => $poll->is_qna
                ? 'QnA polls cannot accept new options.'
                : 'This poll does not allow new options.',
            ], 422);
        }

        if ($poll->options->count() >= PostPoll::ABSOLUTE_MAX_OPTIONS) {
            return response()->json([
                'message' => 'This poll already has the maximum number of options.',
            ], 422);
        }

        $validated = $request->validate([
            'label' => ['required', 'string', 'max:'.PostPoll::MAX_OPTION_LENGTH],
        ]);

        $label = trim($validated['label']);

        if ($label === '') {
            return response()->json(['message' => 'Option text is required.'], 422);
        }

        $duplicate = $poll->options->contains(
            fn ($option) => mb_strtolower($option->label) === mb_strtolower($label)
        );

        if ($duplicate) {
            return response()->json(['message' => 'That option already exists.'], 422);
        }

        $poll->options()->create([
            'label' => $label,
            'sort_order' => ((int) $poll->options->max('sort_order')) + 1,
        ]);

        return response()->json([
            'item' => $this->serializePost($this->reloadPost($post), $viewer),
        ], 201);
    }

    public function update(Request $request, Post $post, PostPoll $poll): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ((int) $viewer->id !== (int) $post->author_user_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($response = $this->ensurePollBelongsToPost($post, $poll)) {
            return $response;
        }

        $poll->load('options');

        if ($poll->is_qna) {
            return response()->json([
                'message' => 'QnA polls cannot be edited after posting.',
            ], 422);
        }

        $validated = $request->validate([
            'allow_multiple' => ['sometimes', 'boolean'],
            'allow_add_options' => ['sometimes', 'boolean'],
            'is_qna' => ['sometimes', 'boolean'],
            'options' => ['required', 'array', 'min:'.PostPoll::MIN_OPTIONS, 'max:'.PostPoll::ABSOLUTE_MAX_OPTIONS],
            'options.*.id' => ['nullable', 'integer'],
            'options.*.label' => ['required', 'string', 'max:'.PostPoll::MAX_OPTION_LENGTH],
        ]);

        if ($validated['is_qna'] ?? false) {
            return response()->json([
                'message' => 'A normal poll cannot be turned into a QnA poll after posting.',
            ], 422);
        }

        $options = collect($validated['options'])
            ->map(fn (array $option) => [
                'id' => isset($option['id']) ? (int) $option['id'] : null,
                'label' => trim((string) $option['label']),
            ])
            ->filter(fn (array $option) => $option['label'] !== '')
            ->unique('label')
            ->values();

        if ($options->count() < PostPoll::MIN_OPTIONS) {
            return response()->json([
                'message' => 'Polls need at least '.PostPoll::MIN_OPTIONS.' unique options.',
            ], 422);
        }

        $allowMultiple = array_key_exists('allow_multiple', $validated)
            ? (bool) $validated['allow_multiple']
            : (bool) $poll->allow_multiple;
        $allowAddOptions = array_key_exists('allow_add_options', $validated)
            ? (bool) $validated['allow_add_options']
            : (bool) $poll->allow_add_options;

        DB::transaction(function () use ($poll, $options, $allowMultiple, $allowAddOptions) {
            $poll->forceFill([
                'allow_multiple' => $allowMultiple,
                'allow_add_options' => $allowAddOptions,
            ])->save();

            $keptIds = [];

            foreach ($options as $index => $optionData) {
                $existing = null;
                if ($optionData['id']) {
                    $existing = $poll->options->firstWhere('id', $optionData['id']);
                }

                if ($existing) {
                    $existing->forceFill([
                        'label' => $optionData['label'],
                        'sort_order' => $index,
                    ])->save();
                    $keptIds[] = (int) $existing->id;

                    continue;
                }

                $created = $poll->options()->create([
                    'label' => $optionData['label'],
                    'sort_order' => $index,
                ]);
                $keptIds[] = (int) $created->id;
            }

            $poll->options()
                ->whereNotIn('id', $keptIds)
                ->each(fn ($option) => $option->delete());

            if (! $allowMultiple) {
                $this->collapseMultiVotesToSingle($poll->id);
            }
        });

        return response()->json([
            'item' => $this->serializePost($this->reloadPost($post), $viewer),
        ]);
    }

    public function store(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ((int) $viewer->id !== (int) $post->author_user_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($response = $this->rejectIfPostDeleted($post)) {
            return $response;
        }

        if ($post->polls()->count() >= PostPoll::MAX_PER_POST) {
            return response()->json([
                'message' => 'A post can have at most '.PostPoll::MAX_PER_POST.' polls.',
            ], 422);
        }

        $validated = $request->validate([
            'allow_multiple' => ['sometimes', 'boolean'],
            'allow_add_options' => ['sometimes', 'boolean'],
            'is_qna' => ['sometimes', 'boolean'],
            'correct_option_index' => ['nullable', 'integer', 'min:0'],
            'options' => ['required', 'array', 'min:'.PostPoll::MIN_OPTIONS, 'max:'.PostPoll::MAX_OPTIONS],
            'options.*' => ['required', 'string', 'max:'.PostPoll::MAX_OPTION_LENGTH],
        ]);

        $conflict = PostPollPayload::conflictMessage($validated);
        if ($conflict) {
            return response()->json(['message' => $conflict], 422);
        }

        $pollData = PostPollPayload::normalize($validated);
        $invalid = PostPollPayload::validationMessage($pollData);
        if ($invalid) {
            return response()->json(['message' => $invalid], 422);
        }

        DB::transaction(function () use ($post, $pollData) {
            PostPollPayload::createOnPost(
                $post,
                $pollData,
                ((int) $post->polls()->max('sort_order')) + 1,
            );
        });

        return response()->json([
            'item' => $this->serializePost($this->reloadPost($post), $viewer),
        ], 201);
    }

    public function destroy(Request $request, Post $post, PostPoll $poll): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ((int) $viewer->id !== (int) $post->author_user_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($response = $this->ensurePollBelongsToPost($post, $poll)) {
            return $response;
        }

        $poll->delete();

        return response()->json([
            'item' => $this->serializePost($this->reloadPost($post), $viewer),
        ]);
    }

    private function ensurePollBelongsToPost(Post $post, PostPoll $poll): ?JsonResponse
    {
        if ($response = $this->rejectIfPostDeleted($post)) {
            return $response;
        }

        if ((int) $poll->post_id !== (int) $post->id) {
            return response()->json(['message' => 'Poll not found on this post.'], 404);
        }

        return null;
    }

    private function collapseMultiVotesToSingle(int $pollId): void
    {
        $votes = PostPollVote::query()
            ->where('post_poll_id', $pollId)
            ->orderByDesc('id')
            ->get()
            ->groupBy('user_id');

        foreach ($votes as $userVotes) {
            $userVotes->slice(1)->each->delete();
        }
    }

    private function reloadPost(Post $post): Post
    {
        $post->load([
            'author.department',
            'reactions',
            'polls.options',
            'polls.votes',
        ])->loadCount(['comments', 'edits', 'views', 'reaches']);

        return $post;
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
