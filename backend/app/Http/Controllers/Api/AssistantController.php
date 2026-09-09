<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\AssistantConversation;
use App\Models\AssistantMessage;
use App\Models\User;
use App\Services\Assistant\AssistantAgent;
use App\Services\PermissionService;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use App\Support\PermissionCatalog;
use App\Support\UserApplicationAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class AssistantController extends Controller
{
    private const MAX_STORED_HISTORY = 40;

    public function __construct(private AssistantAgent $agent) {}

    public function applications(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! PermissionService::can($user, PermissionCatalog::ASSISTANT_USE)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $applications = UserApplicationAccess::accessibleMcpApplicationsQuery($user)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'slug',
                'description',
                'icon_url',
                'color',
                'status',
                'environment',
                'mcp_enabled',
                'is_enabled',
            ])
            ->filter(fn (Application $application) => McpUserAccess::canUseAssistantForApplication($user, $application))
            ->values()
            ->map(fn (Application $application) => [
                'id' => $application->id,
                'name' => $application->name,
                'slug' => $application->slug,
                'description' => $application->description,
                'icon_url' => $application->icon_url,
                'color' => $application->color,
                'status' => $application->status,
                'environment' => $application->environment,
                'mcp_enabled' => (bool) $application->mcp_enabled,
                'is_enabled' => (bool) $application->is_enabled,
                'can_read' => McpUserAccess::canAssistantReadForApplication($user, $application),
                'can_write' => McpUserAccess::canAssistantWriteForApplication($user, $application),
            ]);

        return response()->json(['applications' => $applications]);
    }

    public function conversation(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! PermissionService::can($user, PermissionCatalog::ASSISTANT_USE)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'application_slug' => ['required', 'string', 'max:255'],
        ]);

        $slug = trim((string) $validated['application_slug']);
        $application = $this->resolveAssistantApplication($user, $slug);

        if (! $application) {
            return response()->json(['message' => 'That system is not available for Assistant.'], 404);
        }

        $conversation = AssistantConversation::query()
            ->where('user_id', $user->id)
            ->where('application_slug', $application->slug)
            ->first();

        if (! $conversation) {
            return response()->json([
                'conversation' => null,
                'messages' => [],
            ]);
        }

        $messages = $conversation->messages()
            ->orderBy('id')
            ->get()
            ->map(fn (AssistantMessage $message) => $this->serializeMessage($message))
            ->values();

        return response()->json([
            'conversation' => $this->serializeConversation($conversation),
            'messages' => $messages,
        ]);
    }

    public function clearConversation(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! PermissionService::can($user, PermissionCatalog::ASSISTANT_USE)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'application_slug' => ['required', 'string', 'max:255'],
        ]);

        $slug = trim((string) $validated['application_slug']);

        AssistantConversation::query()
            ->where('user_id', $user->id)
            ->where('application_slug', $slug)
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function chat(Request $request): JsonResponse
    {
        // Agent loops call OpenRouter (and satellite APIs) multiple times.
        // Default PHP/Herd 30s is too short for tool-using chats.
        if (function_exists('set_time_limit')) {
            @set_time_limit(180);
        }
        @ini_set('max_execution_time', '180');

        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! PermissionService::can($user, PermissionCatalog::ASSISTANT_USE)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'application_slug' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:8000'],
            'history' => ['sometimes', 'array', 'max:40'],
            'history.*.role' => ['required_with:history', 'string', 'in:user,assistant'],
            'history.*.content' => ['required_with:history', 'string', 'max:8000'],
        ]);

        $message = trim((string) $validated['message']);
        if ($message === '') {
            return response()->json(['message' => 'Message is required.'], 422);
        }

        $slug = trim((string) $validated['application_slug']);
        $application = $this->resolveAssistantApplication($user, $slug);

        if (! $application) {
            return response()->json(['message' => 'That system is not available for Assistant.'], 404);
        }

        $conversation = $this->findOrCreateConversation($user, $application->slug);
        $history = $this->historyForAgent($conversation, $validated['history'] ?? []);

        $userMessage = AssistantMessage::query()->create([
            'assistant_conversation_id' => $conversation->id,
            'role' => 'user',
            'content' => $message,
            'tool_steps' => null,
            'usage' => null,
        ]);
        $conversation->forceFill(['last_message_at' => now()])->save();

        try {
            $result = $this->agent->chat(
                $user,
                $application->slug,
                $message,
                $history,
            );
        } catch (Throwable $e) {
            $messageText = $e->getMessage();
            $timedOut = str_contains(strtolower($messageText), 'maximum execution time')
                || str_contains(strtolower($messageText), 'timed out')
                || str_contains(strtolower($messageText), 'curl error 28');

            $errorText = $timedOut
                ? 'The assistant took too long to respond. Try a shorter question, or switch to a faster model in Settings → AI.'
                : $messageText;

            $assistantMessage = AssistantMessage::query()->create([
                'assistant_conversation_id' => $conversation->id,
                'role' => 'assistant',
                'content' => $errorText,
                'tool_steps' => [],
                'usage' => null,
            ]);
            $conversation->forceFill(['last_message_at' => now()])->save();

            $status = $timedOut
                ? 504
                : (str_contains($messageText, 'OpenRouter is not configured')
                    || str_contains($messageText, 'OpenRouter request failed')
                    ? 503
                    : 422);

            return response()->json([
                'message' => $errorText,
                'conversation' => $this->serializeConversation($conversation->fresh()),
                'user_message' => $this->serializeMessage($userMessage),
                'assistant_message' => $this->serializeMessage($assistantMessage),
                'tool_steps' => [],
                'usage' => null,
            ], $status);
        }

        $assistantMessage = AssistantMessage::query()->create([
            'assistant_conversation_id' => $conversation->id,
            'role' => 'assistant',
            'content' => (string) ($result['message'] ?? ''),
            'tool_steps' => is_array($result['tool_steps'] ?? null) ? $result['tool_steps'] : [],
            'usage' => is_array($result['usage'] ?? null) ? $result['usage'] : null,
        ]);
        $conversation->forceFill(['last_message_at' => now()])->save();

        return response()->json([
            ...$result,
            'conversation' => $this->serializeConversation($conversation->fresh()),
            'user_message' => $this->serializeMessage($userMessage),
            'assistant_message' => $this->serializeMessage($assistantMessage),
        ]);
    }

    private function resolveAssistantApplication(User $user, string $slug): ?Application
    {
        try {
            $application = UserApplicationAccess::findMcpApplicationForUser($user, $slug);
        } catch (Throwable) {
            return null;
        }

        if (! McpUserAccess::canUseAssistantForApplication($user, $application)) {
            return null;
        }

        return $application;
    }

    private function findOrCreateConversation(User $user, string $applicationSlug): AssistantConversation
    {
        return AssistantConversation::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'application_slug' => $applicationSlug,
            ],
            [
                'last_message_at' => now(),
            ],
        );
    }

    /**
     * @param  list<array{role?: string, content?: string}>  $clientHistory
     * @return list<array{role: string, content: string}>
     */
    private function historyForAgent(AssistantConversation $conversation, array $clientHistory): array
    {
        $stored = $conversation->messages()
            ->whereIn('role', ['user', 'assistant'])
            ->orderByDesc('id')
            ->limit(self::MAX_STORED_HISTORY)
            ->get(['role', 'content'])
            ->reverse()
            ->values()
            ->map(fn (AssistantMessage $message) => [
                'role' => (string) $message->role,
                'content' => (string) $message->content,
            ])
            ->all();

        if ($stored !== []) {
            return $stored;
        }

        return array_values(array_filter(array_map(function ($item) {
            if (! is_array($item)) {
                return null;
            }
            $role = (string) ($item['role'] ?? '');
            $content = trim((string) ($item['content'] ?? ''));
            if (! in_array($role, ['user', 'assistant'], true) || $content === '') {
                return null;
            }

            return ['role' => $role, 'content' => $content];
        }, $clientHistory)));
    }

    /**
     * @return array{id: int, application_slug: string, last_message_at: string|null}
     */
    private function serializeConversation(AssistantConversation $conversation): array
    {
        return [
            'id' => (int) $conversation->id,
            'application_slug' => (string) $conversation->application_slug,
            'last_message_at' => optional($conversation->last_message_at)?->toIso8601String(),
        ];
    }

    /**
     * @return array{id: int, role: string, content: string, tool_steps: list<mixed>|null, usage: array<string, mixed>|null, created_at: string|null}
     */
    private function serializeMessage(AssistantMessage $message): array
    {
        return [
            'id' => (int) $message->id,
            'role' => (string) $message->role,
            'content' => (string) $message->content,
            'tool_steps' => is_array($message->tool_steps) ? $message->tool_steps : null,
            'usage' => is_array($message->usage) ? $message->usage : null,
            'created_at' => optional($message->created_at)?->toIso8601String(),
        ];
    }
}
