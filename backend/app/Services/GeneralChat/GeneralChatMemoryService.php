<?php

namespace App\Services\GeneralChat;

use App\Models\GeneralChatMemory;
use App\Models\User;
use App\Services\Llm\LlmUsageRecorder;
use App\Services\Llm\OpenRouterClient;
use App\Support\GeneralChatSettings;
use Throwable;

class GeneralChatMemoryService
{
    public const MAX_ITEMS = 40;

    public function __construct(private OpenRouterClient $client) {}

    /**
     * @return list<array{id: int, body: string, updated_at: string|null}>
     */
    public function list(User $user): array
    {
        return GeneralChatMemory::query()
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->limit(self::MAX_ITEMS)
            ->get()
            ->map(fn (GeneralChatMemory $memory) => [
                'id' => (int) $memory->id,
                'body' => (string) $memory->body,
                'updated_at' => optional($memory->updated_at)?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    public function promptBlock(User $user): string
    {
        $items = GeneralChatMemory::query()
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->limit(self::MAX_ITEMS)
            ->pluck('body')
            ->filter()
            ->values();

        if ($items->isEmpty()) {
            return '';
        }

        $lines = $items->map(fn ($body) => '- '.$body)->implode("\n");

        return <<<TEXT

Remembered about this user (use when relevant; do not recite the whole list unless asked):
{$lines}
TEXT;
    }

    public function forget(User $user, int $id): void
    {
        GeneralChatMemory::query()
            ->where('user_id', $user->id)
            ->whereKey($id)
            ->delete();
    }

    public function clear(User $user): void
    {
        GeneralChatMemory::query()->where('user_id', $user->id)->delete();
    }

    public function extract(User $user, string $userMessage, string $assistantMessage): void
    {
        $userMessage = trim($userMessage);
        if ($userMessage === '' || mb_strlen($userMessage) < 8) {
            return;
        }

        try {
            $response = $this->client->chat([
                [
                    'role' => 'system',
                    'content' => 'Extract durable personal facts the user would want remembered across future chats. Return JSON only: {"save":["short fact"],"forget":["exact existing fact to remove"]}. Save preferences, names they asked you to use, ongoing projects, language, writing style. Do not save passwords, secrets, ICs, health details, one-off tasks, or anything about this product\'s security. If nothing durable, return {"save":[],"forget":[]}.',
                ],
                [
                    'role' => 'user',
                    'content' => "Existing memories:\n".$this->existingText($user)."\n\nLatest user message:\n{$userMessage}\n\nAssistant reply:\n".mb_substr($assistantMessage, 0, 2000),
                ],
            ], []);
        } catch (Throwable) {
            return;
        }

        $usage = LlmUsageRecorder::extractFromResponse($response);
        try {
            LlmUsageRecorder::record(
                $user,
                $usage,
                GeneralChatSettings::FEATURE,
                null,
                true,
                null,
                ['provider' => 'openrouter', 'metadata' => ['kind' => 'memory_extract']],
            );
        } catch (Throwable) {
            // ignore
        }

        $payload = $this->parseJson($response);
        $saves = is_array($payload['save'] ?? null) ? $payload['save'] : [];
        $forgets = is_array($payload['forget'] ?? null) ? $payload['forget'] : [];

        foreach ($forgets as $forget) {
            $body = $this->normalizeBody($forget);
            if ($body === '') {
                continue;
            }
            GeneralChatMemory::query()
                ->where('user_id', $user->id)
                ->where('body', $body)
                ->delete();
        }

        foreach ($saves as $save) {
            $body = $this->normalizeBody($save);
            if ($body === '') {
                continue;
            }

            GeneralChatMemory::query()->updateOrCreate(
                ['user_id' => $user->id, 'body' => $body],
                ['body' => $body],
            );
        }

        $this->trimOverflow($user);
    }

    public function saveBody(User $user, string $body): ?array
    {
        $body = $this->normalizeBody($body);
        if ($body === '') {
            return null;
        }

        $memory = GeneralChatMemory::query()->updateOrCreate(
            ['user_id' => $user->id, 'body' => $body],
            ['body' => $body],
        );

        $this->trimOverflow($user);

        return [
            'id' => (int) $memory->id,
            'body' => (string) $memory->body,
            'updated_at' => optional($memory->updated_at)?->toIso8601String(),
        ];
    }

    public function importMarkdown(User $user, string $markdown): array
    {
        $added = 0;

        foreach ($this->factsFromMarkdown($markdown) as $fact) {
            if ($this->saveBody($user, $fact)) {
                $added++;
            }
        }

        return $this->list($user);
    }

    /**
     * @return list<string>
     */
    public function factsFromMarkdown(string $markdown): array
    {
        $facts = [];
        foreach (preg_split('/\R/u', $markdown) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || str_starts_with($line, '_')) {
                continue;
            }
            $line = preg_replace('/^[-*+]\s+/', '', $line) ?? $line;
            $line = trim($line);
            if ($line === '' || str_starts_with(mb_strtolower($line), 'exported for ')) {
                continue;
            }
            $facts[] = $line;
        }

        return array_values(array_unique($facts));
    }

    private function trimOverflow(User $user): void
    {
        $keepIds = GeneralChatMemory::query()
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->limit(self::MAX_ITEMS)
            ->pluck('id');

        if ($keepIds->isEmpty()) {
            return;
        }

        GeneralChatMemory::query()
            ->where('user_id', $user->id)
            ->whereNotIn('id', $keepIds)
            ->delete();
    }

    public function toMarkdown(User $user): string
    {
        $items = $this->list($user);
        $who = trim((string) ($user->full_name ?: $user->name ?: $user->email ?: 'User'));
        $when = now()->timezone((string) config('app.timezone', 'UTC'))->toFormattedDateString();
        $lines = [
            '# Chat memory',
            '',
            "Exported for {$who} on {$when}.",
            '',
        ];

        if ($items === []) {
            $lines[] = '_No saved memories._';
            $lines[] = '';

            return implode("\n", $lines);
        }

        foreach ($items as $item) {
            $body = trim((string) ($item['body'] ?? ''));
            if ($body === '') {
                continue;
            }
            $lines[] = '- '.$body;
        }

        $lines[] = '';

        return implode("\n", $lines);
    }

    private function existingText(User $user): string
    {
        $items = GeneralChatMemory::query()
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->limit(self::MAX_ITEMS)
            ->pluck('body');

        return $items->isEmpty() ? '(none)' : $items->map(fn ($body) => '- '.$body)->implode("\n");
    }

    /**
     * @param  array<string, mixed>  $response
     * @return array<string, mixed>
     */
    private function parseJson(array $response): array
    {
        $content = trim((string) ($response['choices'][0]['message']['content'] ?? ''));
        if ($content === '') {
            return [];
        }

        if (preg_match('/\{.*\}/s', $content, $matches)) {
            $content = $matches[0];
        }

        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function normalizeBody(mixed $value): string
    {
        $body = trim(preg_replace('/\s+/', ' ', (string) $value) ?? '');
        if ($body === '') {
            return '';
        }

        return mb_substr($body, 0, 500);
    }
}
