<?php

namespace App\Services\GeneralChat;

use App\Models\User;
use App\Services\Llm\LlmUsageRecorder;
use App\Services\Llm\OpenRouterClient;
use App\Support\AppSettings;
use App\Support\GeneralChatAttachments;
use App\Support\GeneralChatSettings;
use App\Support\GeneralChatTitle;
use RuntimeException;
use Throwable;

class GeneralChatAgent
{
    public function __construct(
        private OpenRouterClient $client,
        private GeneralChatMemoryService $memories,
    ) {}

    /**
     * @param  list<array{role: string, content: mixed}>  $history
     * @param  list<array<string, mixed>>  $attachments
     * @return array{message: string, usage: array<string, mixed>|null}
     */
    public function chat(User $user, string $message, array $history, array $attachments = [], bool $withMemory = true): array
    {
        $userContent = GeneralChatAttachments::toLlmContent($message, $attachments);
        if ($userContent === '') {
            $userContent = 'The user sent an attachment.';
        }

        $messages = array_merge(
            [['role' => 'system', 'content' => $this->systemPrompt($user, $withMemory)]],
            $history,
            [['role' => 'user', 'content' => $userContent]],
        );

        $response = $this->client->chat($messages, []);
        $choice = $response['choices'][0] ?? null;
        $reply = is_array($choice) ? trim((string) ($choice['message']['content'] ?? '')) : '';

        if ($reply === '') {
            throw new RuntimeException('OpenRouter returned no assistant message.');
        }

        $usage = LlmUsageRecorder::extractFromResponse($response);
        $this->recordUsage($user, $usage, true, null, $message, $reply);

        return [
            'message' => $reply,
            'usage' => $usage,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $attachments
     */
    public function suggestTitle(User $user, string $message, string $reply, array $attachments = []): string
    {
        $fallback = GeneralChatTitle::fromMessage($message, $attachments);

        try {
            $response = $this->client->chat([
                [
                    'role' => 'system',
                    'content' => 'Create a short chat thread title. 3 to 7 words, Title Case, no quotes, no trailing punctuation. Name the topic, not the user\'s exact wording. Return the title only.',
                ],
                [
                    'role' => 'user',
                    'content' => "User message:\n".mb_substr($message, 0, 500)."\n\nAssistant reply:\n".mb_substr($reply, 0, 400),
                ],
            ], []);
        } catch (Throwable) {
            return $fallback;
        }

        $usage = LlmUsageRecorder::extractFromResponse($response);
        $this->recordUsage(
            $user,
            $usage,
            true,
            null,
            $message,
            (string) ($response['choices'][0]['message']['content'] ?? ''),
        );

        $raw = trim((string) ($response['choices'][0]['message']['content'] ?? ''));

        return GeneralChatTitle::fromModel($raw, $fallback, $reply);
    }

    /**
     * @param  array<string, mixed>  $usage
     */
    public function recordUsage(
        User $user,
        array $usage,
        bool $ok,
        ?string $errorMessage,
        ?string $inputText,
        ?string $outputText,
    ): void {
        try {
            LlmUsageRecorder::record(
                $user,
                $usage,
                GeneralChatSettings::FEATURE,
                null,
                $ok,
                $errorMessage,
                [
                    'provider' => 'openrouter',
                    'input_text' => $inputText,
                    'output_text' => $outputText,
                ],
            );
        } catch (Throwable) {
            // Usage logging must not block the reply.
        }
    }

    private function systemPrompt(User $user, bool $withMemory = true): string
    {
        $systemName = trim((string) (AppSettings::row()?->system_name ?: config('app.name', 'EMZI Nexus Brain')));
        $memory = $withMemory ? $this->memories->promptBlock($user) : '';
        $displayName = trim((string) ($user->full_name ?: $user->name ?: ''));
        $who = $displayName !== '' ? "The user's name is {$displayName}." : '';

        return <<<PROMPT
You are a helpful general-purpose assistant inside {$systemName}. Answer everyday questions, writing help, explanations, brainstorming, and similar requests.
{$who}{$memory}

Hard rules:
- You cannot change, write, delete, or configure anything in {$systemName} or connected company systems.
- You have no tools and no access to internal APIs, databases, credentials, tokens, or admin settings.
- Refuse requests about this product's security, vulnerabilities, exploits, credentials, secrets, authentication bypass, or how to attack or misuse {$systemName}.
- If asked to perform an in-app write, admin action, or security-sensitive task, refuse and suggest using the normal app screens instead.
- Stay helpful for general knowledge that is unrelated to compromising this system.
- Use remembered facts naturally. Do not invent memories.
- When the user message includes image parts, you can see those images. Describe and answer from what is visible. Do not say you cannot view attachments if images are present.
- When the user message includes extracted text from an attached file, that text is the file contents. Use it. Do not say you cannot open or read the attachment.
PROMPT;
    }
}
