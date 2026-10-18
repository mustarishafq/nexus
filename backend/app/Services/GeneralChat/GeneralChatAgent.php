<?php

namespace App\Services\GeneralChat;

use App\Models\User;
use App\Services\Llm\LlmUsageRecorder;
use App\Services\Llm\OpenRouterClient;
use App\Support\AppSettings;
use App\Support\ChatResponseArtifacts;
use App\Support\GeneralChatAttachments;
use App\Support\GeneralChatSettings;
use App\Support\GeneralChatTitle;
use RuntimeException;
use Throwable;

class GeneralChatAgent
{
    private const MAX_TOOL_ITERATIONS = 4;

    public function __construct(
        private OpenRouterClient $client,
        private GeneralChatMemoryService $memories,
    ) {}

    /**
     * @param  list<array{role: string, content: mixed}>  $history
     * @param  list<array<string, mixed>>  $attachments
     * @return array{
     *   message: string,
     *   visuals: list<array<string, mixed>>,
     *   attachments: list<array<string, mixed>>,
     *   usage: array<string, mixed>|null
     * }
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

        $tools = ChatResponseArtifacts::toolDefinitions();
        $visuals = [];
        $files = [];
        $usageChunks = [];

        try {
            for ($iteration = 0; $iteration < self::MAX_TOOL_ITERATIONS; $iteration++) {
                $response = $this->client->chat($messages, $tools);
                $usageChunks[] = LlmUsageRecorder::extractFromResponse($response);
                $choice = $response['choices'][0]['message'] ?? null;

                if (! is_array($choice)) {
                    throw new RuntimeException('OpenRouter returned no assistant message.');
                }

                $toolCalls = $choice['tool_calls'] ?? null;
                if (! is_array($toolCalls) || $toolCalls === []) {
                    $reply = trim((string) ($choice['content'] ?? ''));
                    if ($reply === '') {
                        $reply = ChatResponseArtifacts::fallbackCaption($visuals, $files);
                    }
                    if ($reply === '') {
                        throw new RuntimeException('OpenRouter returned no assistant message.');
                    }

                    return [
                        'message' => $reply,
                        'visuals' => $visuals,
                        'attachments' => $files,
                        'usage' => $this->recordAggregated($user, $usageChunks, true, null, $message, $reply),
                    ];
                }

                $messages[] = $this->assistantMessageForHistory($choice);

                foreach ($toolCalls as $toolCall) {
                    if (! is_array($toolCall)) {
                        continue;
                    }

                    $name = (string) ($toolCall['function']['name'] ?? '');
                    $arguments = $this->decodeArguments($toolCall['function']['arguments'] ?? '{}');
                    $step = ChatResponseArtifacts::execute($user, $name, $arguments, count($visuals), count($files));
                    if (is_array($step['visual'] ?? null)) {
                        $visuals[] = $step['visual'];
                    }
                    if (is_array($step['attachment'] ?? null)) {
                        $files[] = $step['attachment'];
                    }

                    $toolCallId = (string) ($toolCall['id'] ?? '');
                    $encoded = json_encode($step['output'], JSON_UNESCAPED_SLASHES);
                    $messages[] = [
                        'role' => 'tool',
                        'tool_call_id' => $toolCallId !== '' ? $toolCallId : ('call_'.$iteration),
                        'content' => is_string($encoded) ? $encoded : '{"error":"Could not encode tool result."}',
                    ];
                }
            }
        } catch (Throwable $e) {
            $this->recordAggregated($user, $usageChunks, false, $e->getMessage(), $message, null);

            throw $e;
        }

        $reply = ChatResponseArtifacts::fallbackCaption($visuals, $files);
        if ($reply === '') {
            $reply = 'I could not finish that. Try a more specific question.';
        }

        return [
            'message' => $reply,
            'visuals' => $visuals,
            'attachments' => $files,
            'usage' => $this->recordAggregated($user, $usageChunks, true, null, $message, $reply),
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
        $artifactRules = ChatResponseArtifacts::instruction();

        return <<<PROMPT
You are a helpful general-purpose assistant inside {$systemName}. Answer everyday questions, writing help, explanations, brainstorming, and similar requests.
{$who}{$memory}

Hard rules:
- You cannot change, write, delete, or configure anything in {$systemName} or connected company systems.
- You have no access to internal APIs, databases, credentials, tokens, or admin settings.
- The only tools you may call are present_chart and create_spreadsheet. They only draw a chart or attach a CSV/Excel file. They do not read or change this system.
- Refuse requests about this product's security, vulnerabilities, exploits, credentials, secrets, authentication bypass, or how to attack or misuse {$systemName}.
- If asked to perform an in-app write, admin action, or security-sensitive task, refuse and suggest using the normal app screens instead.
- Stay helpful for general knowledge that is unrelated to compromising this system.
- Use remembered facts naturally. Do not invent memories.
- When the user message includes image parts, you can see those images. Describe and answer from what is visible. Do not say you cannot view attachments if images are present.
- When the user message includes extracted text from an attached file, that text is the file contents. Use it. Do not say you cannot open or read the attachment.
{$artifactRules}
PROMPT;
    }

    /**
     * @param  list<array<string, mixed>>  $chunks
     * @return array<string, mixed>|null
     */
    private function recordAggregated(
        User $user,
        array $chunks,
        bool $ok,
        ?string $errorMessage,
        ?string $inputText,
        ?string $outputText,
    ): ?array {
        if ($chunks === []) {
            return null;
        }

        $usage = LlmUsageRecorder::aggregate($chunks);
        $this->recordUsage($user, $usage, $ok, $errorMessage, $inputText, $outputText);

        return $usage;
    }

    /**
     * @param  array<string, mixed>  $choice
     * @return array<string, mixed>
     */
    private function assistantMessageForHistory(array $choice): array
    {
        $message = [
            'role' => 'assistant',
            'content' => $choice['content'] ?? null,
        ];

        if (! empty($choice['tool_calls']) && is_array($choice['tool_calls'])) {
            $message['tool_calls'] = array_values(array_map(function ($toolCall) {
                if (! is_array($toolCall)) {
                    return $toolCall;
                }

                unset($toolCall['index']);

                return $toolCall;
            }, $choice['tool_calls']));
        }

        foreach (['reasoning', 'reasoning_details', 'refusal'] as $key) {
            if (array_key_exists($key, $choice) && $choice[$key] !== null && $choice[$key] !== '') {
                $message[$key] = $choice[$key];
            }
        }

        return $message;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeArguments(mixed $rawArgs): array
    {
        if (is_array($rawArgs)) {
            return $rawArgs;
        }

        if (! is_string($rawArgs) || trim($rawArgs) === '') {
            return [];
        }

        $decoded = json_decode($rawArgs, true);

        return is_array($decoded) ? $decoded : [];
    }
}
