<?php

namespace App\Services\Llm;

use App\Models\LlmUsageLog;
use App\Models\User;

class LlmUsageRecorder
{
    /**
     * Normalize OpenRouter (or OpenAI-compatible) usage from a chat completion response.
     *
     * @param  array<string, mixed>  $response
     * @return array{
     *   model: ?string,
     *   generation_id: ?string,
     *   prompt_tokens: int,
     *   completion_tokens: int,
     *   total_tokens: int,
     *   reasoning_tokens: int,
     *   cached_tokens: int,
     *   cost: ?float,
     *   upstream_cost: ?float,
     * }
     */
    public static function extractFromResponse(array $response): array
    {
        $usage = is_array($response['usage'] ?? null) ? $response['usage'] : [];
        $promptDetails = is_array($usage['prompt_tokens_details'] ?? null) ? $usage['prompt_tokens_details'] : [];
        $completionDetails = is_array($usage['completion_tokens_details'] ?? null) ? $usage['completion_tokens_details'] : [];
        $costDetails = is_array($usage['cost_details'] ?? null) ? $usage['cost_details'] : [];

        $prompt = (int) ($usage['prompt_tokens'] ?? 0);
        $completion = (int) ($usage['completion_tokens'] ?? 0);
        $total = (int) ($usage['total_tokens'] ?? ($prompt + $completion));

        return [
            'model' => isset($response['model']) ? (string) $response['model'] : null,
            'generation_id' => isset($response['id']) ? (string) $response['id'] : null,
            'prompt_tokens' => $prompt,
            'completion_tokens' => $completion,
            'total_tokens' => $total,
            'reasoning_tokens' => (int) ($completionDetails['reasoning_tokens'] ?? 0),
            'cached_tokens' => (int) ($promptDetails['cached_tokens'] ?? 0),
            'cost' => self::nullableFloat($usage['cost'] ?? null),
            'upstream_cost' => self::nullableFloat($costDetails['upstream_inference_cost'] ?? null),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $chunks
     * @return array{
     *   model: ?string,
     *   generation_id: ?string,
     *   prompt_tokens: int,
     *   completion_tokens: int,
     *   total_tokens: int,
     *   reasoning_tokens: int,
     *   cached_tokens: int,
     *   cost: ?float,
     *   upstream_cost: ?float,
     *   request_count: int,
     * }
     */
    public static function aggregate(array $chunks): array
    {
        $aggregated = [
            'model' => null,
            'generation_id' => null,
            'prompt_tokens' => 0,
            'completion_tokens' => 0,
            'total_tokens' => 0,
            'reasoning_tokens' => 0,
            'cached_tokens' => 0,
            'cost' => null,
            'upstream_cost' => null,
            'request_count' => count($chunks),
        ];

        $costSum = 0.0;
        $hasCost = false;
        $upstreamSum = 0.0;
        $hasUpstream = false;

        foreach ($chunks as $chunk) {
            if (! is_array($chunk)) {
                continue;
            }

            $aggregated['prompt_tokens'] += (int) ($chunk['prompt_tokens'] ?? 0);
            $aggregated['completion_tokens'] += (int) ($chunk['completion_tokens'] ?? 0);
            $aggregated['total_tokens'] += (int) ($chunk['total_tokens'] ?? 0);
            $aggregated['reasoning_tokens'] += (int) ($chunk['reasoning_tokens'] ?? 0);
            $aggregated['cached_tokens'] += (int) ($chunk['cached_tokens'] ?? 0);

            if (! empty($chunk['model'])) {
                $aggregated['model'] = (string) $chunk['model'];
            }

            if (! empty($chunk['generation_id'])) {
                $aggregated['generation_id'] = (string) $chunk['generation_id'];
            }

            if (array_key_exists('cost', $chunk) && $chunk['cost'] !== null) {
                $costSum += (float) $chunk['cost'];
                $hasCost = true;
            }

            if (array_key_exists('upstream_cost', $chunk) && $chunk['upstream_cost'] !== null) {
                $upstreamSum += (float) $chunk['upstream_cost'];
                $hasUpstream = true;
            }
        }

        $aggregated['cost'] = $hasCost ? $costSum : null;
        $aggregated['upstream_cost'] = $hasUpstream ? $upstreamSum : null;

        return $aggregated;
    }

    /**
     * @param  array<string, mixed>  $usage
     * @param  array<string, mixed>  $extra
     */
    public static function record(
        ?User $user,
        array $usage,
        string $feature = 'assistant',
        ?string $applicationSlug = null,
        bool $ok = true,
        ?string $errorMessage = null,
        array $extra = [],
    ): LlmUsageLog {
        return LlmUsageLog::query()->create([
            'user_id' => $user?->id,
            'provider' => (string) ($extra['provider'] ?? 'openrouter'),
            'model' => $usage['model'] ?? ($extra['model'] ?? null),
            'feature' => $feature,
            'application_slug' => $applicationSlug,
            'prompt_tokens' => (int) ($usage['prompt_tokens'] ?? 0),
            'completion_tokens' => (int) ($usage['completion_tokens'] ?? 0),
            'total_tokens' => (int) ($usage['total_tokens'] ?? 0),
            'reasoning_tokens' => (int) ($usage['reasoning_tokens'] ?? 0),
            'cached_tokens' => (int) ($usage['cached_tokens'] ?? 0),
            'cost' => $usage['cost'] ?? null,
            'upstream_cost' => $usage['upstream_cost'] ?? null,
            'generation_id' => $usage['generation_id'] ?? null,
            'request_count' => (int) ($usage['request_count'] ?? 1),
            'ok' => $ok,
            'error_message' => $errorMessage !== null ? mb_substr($errorMessage, 0, 500) : null,
            'input_text' => self::clipText($extra['input_text'] ?? null),
            'output_text' => self::clipText($extra['output_text'] ?? null),
            'metadata' => $extra['metadata'] ?? null,
        ]);
    }

    private static function clipText(mixed $value, int $max = 32000): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        if (mb_strlen($text) <= $max) {
            return $text;
        }

        return mb_substr($text, 0, $max)."\n…[truncated]";
    }

    private static function nullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }
}
