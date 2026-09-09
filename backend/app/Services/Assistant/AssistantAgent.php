<?php

namespace App\Services\Assistant;

use App\Models\Application;
use App\Models\User;
use App\Services\Llm\LlmUsageRecorder;
use App\Services\Llm\OpenRouterClient;
use App\Services\Mcp\Tools\CallApplicationApiTool;
use App\Services\Mcp\Tools\DescribeApplicationApiTool;
use App\Support\McpUserAccess;
use App\Support\UserApplicationAccess;
use Carbon\Carbon;
use RuntimeException;
use Throwable;

class AssistantAgent
{
    private const MAX_TOOL_ITERATIONS = 5;

    private const MAX_HISTORY_TURNS = 20;

    public function __construct(
        private OpenRouterClient $openRouter,
        private DescribeApplicationApiTool $describeTool,
        private CallApplicationApiTool $callTool,
    ) {}

    /**
     * @param  list<array{role: string, content: string}>  $history
     * @return array{
     *   message: string,
     *   tool_steps: list<array{name: string, summary: string, ok: bool}>,
     *   usage: array<string, mixed>|null
     * }
     */
    public function chat(User $user, string $applicationSlug, string $message, array $history = []): array
    {
        $application = UserApplicationAccess::findMcpApplicationForUser($user, $applicationSlug);

        if (! McpUserAccess::canUseAssistantForApplication($user, $application)) {
            throw new RuntimeException("Assistant access is disabled for {$application->slug}.");
        }

        $tools = $this->openAiToolsForApplication($user, $application);

        if ($tools === []) {
            throw new RuntimeException("You don't have Assistant tool access for {$application->slug}.");
        }

        $messages = [
            ['role' => 'system', 'content' => $this->systemPrompt($application)],
            ...$this->normalizeHistory($history),
            ['role' => 'user', 'content' => $message],
        ];

        $toolSteps = [];
        $usageChunks = [];
        $fallbackModel = (string) config('services.openrouter.default_model', 'openai/gpt-4o-mini');
        $deadlineAt = microtime(true) + 150;

        try {
            for ($iteration = 0; $iteration < self::MAX_TOOL_ITERATIONS; $iteration++) {
                if (microtime(true) >= $deadlineAt) {
                    throw new RuntimeException(
                        'The assistant took too long to respond. Try a shorter question, or switch to a faster model in Settings → AI.'
                    );
                }

                $response = $this->openRouter->chat($messages, $tools);
                $usageChunks[] = LlmUsageRecorder::extractFromResponse($response);
                $choice = $response['choices'][0]['message'] ?? null;

                if (! is_array($choice)) {
                    throw new RuntimeException('OpenRouter returned no assistant message.');
                }

                $toolCalls = $choice['tool_calls'] ?? null;

                if (! is_array($toolCalls) || $toolCalls === []) {
                    $content = trim((string) ($choice['content'] ?? ''));

                    if ($content === '') {
                        $content = 'I could not produce an answer. Please try rephrasing your question.';
                    }

                    $usage = $this->persistUsage(
                        $user,
                        $application,
                        $usageChunks,
                        $fallbackModel,
                        true,
                        null,
                        [
                            'tool_steps' => count($toolSteps),
                            'input_text' => $message,
                            'output_text' => $content,
                        ],
                    );

                    return [
                        'message' => $content,
                        'tool_steps' => $toolSteps,
                        'usage' => $usage,
                    ];
                }

                $assistantMessage = $this->assistantMessageForHistory($choice);
                $messages[] = $assistantMessage;

                foreach ($toolCalls as $toolCall) {
                    if (! is_array($toolCall)) {
                        continue;
                    }

                    $toolCallId = (string) ($toolCall['id'] ?? '');
                    $name = (string) ($toolCall['function']['name'] ?? '');
                    $rawArgs = $toolCall['function']['arguments'] ?? '{}';
                    $arguments = $this->decodeArguments($rawArgs);
                    $arguments['slug'] = $application->slug;

                    $step = $this->executeTool($user, $application, $name, $arguments);
                    $toolSteps[] = [
                        'name' => $name,
                        'summary' => $step['summary'],
                        'ok' => $step['ok'],
                    ];

                    $messages[] = [
                        'role' => 'tool',
                        'tool_call_id' => $toolCallId !== '' ? $toolCallId : ('call_'.$iteration),
                        'content' => $this->encodeToolResult($step['output']),
                    ];
                }
            }

            $limitMessage = 'I reached the tool-call limit while investigating that. Try a more specific question.';
            $usage = $this->persistUsage(
                $user,
                $application,
                $usageChunks,
                $fallbackModel,
                true,
                null,
                [
                    'tool_steps' => count($toolSteps),
                    'hit_tool_limit' => true,
                    'input_text' => $message,
                    'output_text' => $limitMessage,
                ],
            );

            return [
                'message' => $limitMessage,
                'tool_steps' => $toolSteps,
                'usage' => $usage,
            ];
        } catch (Throwable $e) {
            $this->persistUsage(
                $user,
                $application,
                $usageChunks,
                $fallbackModel,
                false,
                $e->getMessage(),
                [
                    'tool_steps' => count($toolSteps),
                    'input_text' => $message,
                    'output_text' => null,
                ],
            );

            throw $e;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $usageChunks
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>|null
     */
    private function persistUsage(
        User $user,
        Application $application,
        array $usageChunks,
        string $fallbackModel,
        bool $ok,
        ?string $errorMessage,
        array $payload = [],
    ): ?array {
        if ($usageChunks === [] && $ok) {
            return null;
        }

        $aggregated = LlmUsageRecorder::aggregate($usageChunks);
        if (empty($aggregated['model'])) {
            $aggregated['model'] = $fallbackModel;
        }

        if ($usageChunks === []) {
            $aggregated['request_count'] = 0;
        }

        $inputText = $payload['input_text'] ?? null;
        $outputText = $payload['output_text'] ?? null;
        unset($payload['input_text'], $payload['output_text']);

        try {
            $log = LlmUsageRecorder::record(
                $user,
                $aggregated,
                'assistant',
                $application->slug,
                $ok,
                $errorMessage,
                [
                    'provider' => 'openrouter',
                    'input_text' => $inputText,
                    'output_text' => $outputText,
                    'metadata' => $payload === [] ? null : $payload,
                ],
            );
        } catch (Throwable) {
            return [
                'prompt_tokens' => $aggregated['prompt_tokens'],
                'completion_tokens' => $aggregated['completion_tokens'],
                'total_tokens' => $aggregated['total_tokens'],
                'cost' => $aggregated['cost'],
                'model' => $aggregated['model'],
                'request_count' => $aggregated['request_count'],
            ];
        }

        return [
            'id' => $log->id,
            'prompt_tokens' => $log->prompt_tokens,
            'completion_tokens' => $log->completion_tokens,
            'total_tokens' => $log->total_tokens,
            'reasoning_tokens' => $log->reasoning_tokens,
            'cached_tokens' => $log->cached_tokens,
            'cost' => $log->cost,
            'upstream_cost' => $log->upstream_cost,
            'model' => $log->model,
            'request_count' => $log->request_count,
        ];
    }

    private function systemPrompt(Application $application): string
    {
        $name = $application->name;
        $slug = $application->slug;
        $now = Carbon::now();
        $currentDateTime = $now->translatedFormat('l, j F Y, H:i');
        $timezone = $now->timezoneName;

        return <<<PROMPT
You are the Nexus Assistant inside EMZI Nexus Brain.
You help the signed-in user ask questions about one connected system at a time.

Current date and time: {$currentDateTime} ({$timezone})

Current system:
- name: {$name}
- slug: {$slug}

Rules:
- Trust the "Current date and time" above as ground truth for today's date. Never infer today's date from tool results, record timestamps, or your training data.
- Answer only using tools against this system. Do not invent API paths or data.
- Prefer describe_application_api before inventing endpoints, then call_application_api.
- If a catalog or API call fails, say so clearly and suggest what the user can check.
- Do not claim access to other Nexus applications in this conversation.
- Be concise and practical. Prefer clear summaries over dumping raw JSON unless asked.
- Format answers in Markdown (bold, lists, links).
- When a response includes image evidence or media URLs, embed them with Markdown images like ![label](https://...), not only as text links.
PROMPT;
    }

    /**
     * @param  list<array{role?: mixed, content?: mixed}>  $history
     * @return list<array{role: string, content: string}>
     */
    private function normalizeHistory(array $history): array
    {
        $normalized = [];

        foreach ($history as $item) {
            if (! is_array($item)) {
                continue;
            }

            $role = (string) ($item['role'] ?? '');
            $content = trim((string) ($item['content'] ?? ''));

            if (! in_array($role, ['user', 'assistant'], true) || $content === '') {
                continue;
            }

            $normalized[] = ['role' => $role, 'content' => $content];
        }

        if (count($normalized) > self::MAX_HISTORY_TURNS) {
            $normalized = array_slice($normalized, -self::MAX_HISTORY_TURNS);
        }

        return $normalized;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function openAiToolsForApplication(User $user, Application $application): array
    {
        $tools = [];
        $methods = McpUserAccess::assistantHttpMethodsForApplication($user, $application);
        $canDescribe = $methods !== [];
        $canCall = $methods !== [];

        if ($canDescribe) {
            $tools[] = [
                'type' => 'function',
                'function' => [
                    'name' => 'describe_application_api',
                    'description' => 'List API endpoints (method, path, params, description) this connected system exposes right now. Fetched live from the system catalog.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => (object) [],
                        'additionalProperties' => false,
                    ],
                ],
            ];
        }

        if ($canCall && $methods !== []) {
            $properties = [
                'method' => [
                    'type' => 'string',
                    'enum' => $methods,
                    'description' => 'HTTP method.',
                ],
                'path' => [
                    'type' => 'string',
                    'description' => 'Path relative to the application base URL, e.g. /api/leads/123.',
                ],
            ];

            if (in_array('GET', $methods, true)) {
                $properties['query'] = [
                    'type' => 'object',
                    'description' => 'Query string parameters for GET requests.',
                    'additionalProperties' => true,
                ];
            }

            if (array_intersect($methods, ['POST', 'PUT', 'PATCH', 'DELETE']) !== []) {
                $properties['body'] = [
                    'type' => 'object',
                    'description' => 'JSON body for write requests.',
                    'additionalProperties' => true,
                ];
            }

            $tools[] = [
                'type' => 'function',
                'function' => [
                    'name' => 'call_application_api',
                    'description' => 'Call an endpoint on this connected system using Nexus MCP credentials. Use describe_application_api first when unsure which path to call.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => $properties,
                        'required' => ['path'],
                        'additionalProperties' => false,
                    ],
                ],
            ];
        }

        return $tools;
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array{ok: bool, summary: string, output: array<string, mixed>}
     */
    private function executeTool(User $user, Application $application, string $name, array $arguments): array
    {
        if (! in_array($name, ['describe_application_api', 'call_application_api'], true)) {
            return [
                'ok' => false,
                'summary' => "Unknown tool: {$name}",
                'output' => ['error' => "Unknown tool: {$name}"],
            ];
        }

        $methods = McpUserAccess::assistantHttpMethodsForApplication($user, $application);
        if ($methods === []) {
            return [
                'ok' => false,
                'summary' => "Assistant access is disabled for {$application->slug}.",
                'output' => ['error' => "Assistant access is disabled for {$application->slug}."],
            ];
        }

        if ($name === 'call_application_api') {
            $method = strtoupper((string) ($arguments['method'] ?? 'GET'));
            if (! in_array($method, $methods, true)) {
                $message = "HTTP {$method} is not allowed for {$application->slug} in Assistant.";

                return [
                    'ok' => false,
                    'summary' => $message,
                    'output' => ['error' => $message],
                ];
            }
        }

        try {
            $tool = $name === 'describe_application_api' ? $this->describeTool : $this->callTool;
            $output = $tool->call($user, $arguments);

            return [
                'ok' => true,
                'summary' => $this->summarizeToolResult($name, $arguments, $output),
                'output' => $output,
            ];
        } catch (\Throwable $e) {
            return [
                'ok' => false,
                'summary' => $e->getMessage(),
                'output' => ['error' => $e->getMessage()],
            ];
        }
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @param  array<string, mixed>  $output
     */
    private function summarizeToolResult(string $name, array $arguments, array $output): string
    {
        if ($name === 'describe_application_api') {
            $count = is_array($output['endpoints'] ?? null) ? count($output['endpoints']) : 0;

            if (! empty($output['note'])) {
                return (string) $output['note'];
            }

            return $count === 1
                ? 'Fetched API catalog (1 endpoint)'
                : "Fetched API catalog ({$count} endpoints)";
        }

        $method = strtoupper((string) ($arguments['method'] ?? 'GET'));
        $path = (string) ($arguments['path'] ?? '/');
        $status = $output['status'] ?? null;

        if ($status !== null) {
            return "{$method} {$path} → HTTP {$status}";
        }

        return "{$method} {$path}";
    }

    /**
     * Keep provider-specific fields (reasoning) so follow-up tool turns work
     * with reasoning models on OpenRouter.
     *
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
     * @param  array<string, mixed>  $output
     */
    private function encodeToolResult(array $output): string
    {
        $encoded = json_encode($output, JSON_UNESCAPED_SLASHES);
        if (! is_string($encoded)) {
            return '{"error":"Could not encode tool result."}';
        }

        // Keep follow-up prompts manageable for free/provider models.
        $maxChars = 24000;
        if (strlen($encoded) <= $maxChars) {
            return $encoded;
        }

        if (isset($output['endpoints']) && is_array($output['endpoints'])) {
            $trimmed = $output;
            $trimmed['endpoints'] = array_slice($output['endpoints'], 0, 40);
            $trimmed['note'] = ($output['note'] ?? '').' Catalog truncated for model context.';
            $encoded = json_encode($trimmed, JSON_UNESCAPED_SLASHES) ?: $encoded;
        }

        if (strlen($encoded) > $maxChars) {
            return substr($encoded, 0, $maxChars).'…"}';
        }

        return $encoded;
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
