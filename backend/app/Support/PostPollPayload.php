<?php

namespace App\Support;

use App\Models\Post;
use App\Models\PostPoll;

class PostPollPayload
{
    /**
     * @param  array<string, mixed>  $poll
     * @return array{
     *     options: list<string>,
     *     allow_multiple: bool,
     *     allow_add_options: bool,
     *     is_qna: bool,
     *     correct_option_index: int|null
     * }
     */
    public static function normalize(array $poll, int $maxOptions = PostPoll::MAX_OPTIONS): array
    {
        $options = collect($poll['options'] ?? [])
            ->map(function ($option) {
                if (is_string($option) || is_numeric($option)) {
                    return trim((string) $option);
                }

                if (is_array($option)) {
                    return trim((string) ($option['label'] ?? ''));
                }

                return '';
            })
            ->filter()
            ->unique()
            ->values()
            ->take($maxOptions)
            ->all();

        $isQna = (bool) ($poll['is_qna'] ?? false);
        $correctIndex = null;
        if (array_key_exists('correct_option_index', $poll) && $poll['correct_option_index'] !== null && $poll['correct_option_index'] !== '') {
            $correctIndex = (int) $poll['correct_option_index'];
        }

        return [
            'options' => $options,
            'allow_multiple' => $isQna ? false : (bool) ($poll['allow_multiple'] ?? false),
            'allow_add_options' => $isQna ? false : (bool) ($poll['allow_add_options'] ?? false),
            'is_qna' => $isQna,
            'correct_option_index' => $isQna ? $correctIndex : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $poll
     */
    public static function conflictMessage(array $poll): ?string
    {
        if (! ($poll['is_qna'] ?? false)) {
            return null;
        }

        if (($poll['allow_multiple'] ?? false) || ($poll['allow_add_options'] ?? false)) {
            return 'QnA polls cannot allow multiple choices or extra options.';
        }

        return null;
    }

    /**
     * @param  array{
     *     options: list<string>,
     *     allow_multiple: bool,
     *     allow_add_options: bool,
     *     is_qna: bool,
     *     correct_option_index: int|null
     * }  $poll
     */
    public static function validationMessage(array $poll): ?string
    {
        if (count($poll['options']) < PostPoll::MIN_OPTIONS) {
            return 'Polls need at least '.PostPoll::MIN_OPTIONS.' unique options.';
        }

        if (! $poll['is_qna']) {
            return null;
        }

        $index = $poll['correct_option_index'];
        if ($index === null || $index < 0 || $index >= count($poll['options'])) {
            return 'QnA polls need one correct option.';
        }

        return null;
    }

    /**
     * @param  array{
     *     options: list<string>,
     *     allow_multiple: bool,
     *     allow_add_options: bool,
     *     is_qna: bool,
     *     correct_option_index: int|null
     * }  $poll
     */
    public static function createOnPost(Post $post, array $poll, int $sortOrder): PostPoll
    {
        $created = $post->polls()->create([
            'sort_order' => $sortOrder,
            'allow_multiple' => $poll['allow_multiple'],
            'allow_add_options' => $poll['allow_add_options'],
            'is_qna' => $poll['is_qna'],
        ]);

        $correctId = null;
        foreach ($poll['options'] as $index => $label) {
            $option = $created->options()->create([
                'label' => $label,
                'sort_order' => $index,
            ]);

            if ($poll['is_qna'] && $poll['correct_option_index'] === $index) {
                $correctId = $option->id;
            }
        }

        if ($correctId) {
            $created->forceFill(['correct_option_id' => $correctId])->save();
        }

        return $created;
    }
}
