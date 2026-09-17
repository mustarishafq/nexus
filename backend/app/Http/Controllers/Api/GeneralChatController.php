<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GeneralChatConversation;
use App\Models\GeneralChatMemory;
use App\Models\GeneralChatMessage;
use App\Models\User;
use App\Services\GeneralChat\GeneralChatAgent;
use App\Services\GeneralChat\GeneralChatMemoryService;
use App\Services\GeneralChat\GeneralChatQuotaService;
use App\Services\PermissionService;
use App\Support\ApiTokenAuth;
use App\Support\GeneralChatAttachments;
use App\Support\GeneralChatTitle;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class GeneralChatController extends Controller
{
    private const MAX_STORED_HISTORY = 40;

    public function __construct(
        private GeneralChatAgent $agent,
        private GeneralChatQuotaService $quota,
        private GeneralChatMemoryService $memories,
    ) {}

    public function quota(Request $request): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        return response()->json(['quota' => $this->quota->snapshot($user)]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $conversations = GeneralChatConversation::query()
            ->where('user_id', $user->id)
            ->orderByRaw('pinned_at is null')
            ->orderByDesc('pinned_at')
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (GeneralChatConversation $conversation) => $this->serializeConversation($conversation, $user))
            ->values();

        return response()->json([
            'conversations' => $conversations,
            'quota' => $this->quota->snapshot($user),
            'memories' => $this->memories->list($user),
            'auto_memory' => $user->generalChatAutoMemoryEnabled(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $conversation = GeneralChatConversation::query()->create([
            'user_id' => $user->id,
            'title' => 'New chat',
            'last_message_at' => now(),
        ]);

        return response()->json([
            'conversation' => $this->serializeConversation($conversation, $user),
            'messages' => [],
            'quota' => $this->quota->snapshot($user),
        ], 201);
    }

    public function show(Request $request, GeneralChatConversation $conversation): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if ((int) $conversation->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $messages = $conversation->messages()
            ->orderBy('id')
            ->get()
            ->map(fn (GeneralChatMessage $message) => $this->serializeMessage($message))
            ->values();

        return response()->json([
            'conversation' => $this->serializeConversation($conversation, $user),
            'messages' => $messages,
            'quota' => $this->quota->snapshot($user),
        ]);
    }

    public function update(Request $request, GeneralChatConversation $conversation): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if ((int) $conversation->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:120'],
            'pinned' => ['sometimes', 'boolean'],
            'use_memory' => ['sometimes', 'nullable', 'boolean'],
        ]);

        if (array_key_exists('title', $validated)) {
            $title = trim((string) $validated['title']);
            $conversation->title = $title !== '' ? $title : 'New chat';
        }

        if (array_key_exists('pinned', $validated)) {
            $conversation->pinned_at = $validated['pinned'] ? now() : null;
        }

        if (array_key_exists('use_memory', $validated)) {
            $conversation->use_memory = $validated['use_memory'];
        }

        $conversation->save();

        return response()->json([
            'conversation' => $this->serializeConversation($conversation->fresh(), $user),
        ]);
    }

    public function destroy(Request $request, GeneralChatConversation $conversation): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if ((int) $conversation->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $conversation->delete();

        return response()->json([
            'ok' => true,
            'quota' => $this->quota->snapshot($user),
        ]);
    }

    public function memories(Request $request): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        return response()->json(['memories' => $this->memories->list($user)]);
    }

    public function storeMemory(Request $request): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:500'],
        ]);

        $this->memories->saveBody($user, $validated['body']);

        return response()->json(['memories' => $this->memories->list($user)], 201);
    }

    public function importMemories(Request $request): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'markdown' => ['required', 'string', 'max:20000'],
        ]);

        return response()->json([
            'memories' => $this->memories->importMarkdown($user, $validated['markdown']),
        ]);
    }

    public function updateMemorySettings(Request $request): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = $request->validate([
            'auto_memory' => ['required', 'boolean'],
        ]);

        $user->general_chat_auto_memory = (bool) $validated['auto_memory'];
        $user->save();

        return response()->json([
            'auto_memory' => $user->generalChatAutoMemoryEnabled(),
            'memories' => $this->memories->list($user),
        ]);
    }

    public function destroyMemory(Request $request, GeneralChatMemory $memory): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        if ((int) $memory->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->memories->forget($user, (int) $memory->id);

        return response()->json(['memories' => $this->memories->list($user)]);
    }

    public function clearMemories(Request $request): JsonResponse
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $this->memories->clear($user);

        return response()->json(['memories' => []]);
    }

    public function exportMemories(Request $request)
    {
        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $markdown = $this->memories->toMarkdown($user);
        $filename = 'chat-memory-'.now()->format('Y-m-d').'.md';

        return response($markdown, 200, [
            'Content-Type' => 'text/markdown; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function chat(Request $request): JsonResponse
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit(180);
        }
        @ini_set('max_execution_time', '180');

        $user = $this->authorizedUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $this->quota->assertCanSpend($user);

        $incomingAttachments = $request->input('attachments');
        if (is_array($incomingAttachments)) {
            $request->merge([
                'attachments' => array_values(array_filter(array_map(function ($item) {
                    if (! is_array($item)) {
                        return null;
                    }

                    $url = trim((string) ($item['url'] ?? $item['file_url'] ?? ''));
                    if ($url === '' || str_starts_with($url, 'blob:') || str_starts_with($url, 'data:')) {
                        return null;
                    }

                    unset($item['file'], $item['previewUrl'], $item['preview_url']);
                    $item['url'] = $url;

                    return $item;
                }, $incomingAttachments))),
            ]);
        }

        $validated = $request->validate([
            'conversation_id' => ['sometimes', 'nullable', 'integer', 'exists:general_chat_conversations,id'],
            'message' => ['nullable', 'string', 'max:8000'],
            'attachments' => ['sometimes', 'array', 'max:'.GeneralChatAttachments::MAX_COUNT],
            'attachments.*.url' => ['required', 'string', 'max:2048'],
            'attachments.*.name' => ['sometimes', 'nullable', 'string', 'max:180'],
            'attachments.*.mime' => ['sometimes', 'nullable', 'string', 'max:120'],
            'attachments.*.size' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'history' => ['sometimes', 'array', 'max:40'],
            'history.*.role' => ['required_with:history', 'string', 'in:user,assistant'],
            'history.*.content' => ['required_with:history', 'string', 'max:8000'],
            'use_memory' => ['sometimes', 'nullable', 'boolean'],
        ]);

        $message = trim((string) ($validated['message'] ?? ''));
        $attachments = GeneralChatAttachments::normalize($validated['attachments'] ?? []);

        if ($message === '' && $attachments === []) {
            return response()->json(['message' => 'Message or attachment is required.'], 422);
        }

        $conversation = $this->resolveConversation($user, $validated['conversation_id'] ?? null);
        if ($conversation instanceof JsonResponse) {
            return $conversation;
        }

        if (array_key_exists('use_memory', $validated)) {
            $conversation->use_memory = $validated['use_memory'];
            $conversation->save();
        }

        $autoMemory = $user->generalChatAutoMemoryEnabled();
        $withMemory = $conversation->usesMemory($autoMemory);

        $history = $this->historyForAgent($conversation, $validated['history'] ?? []);

        $userMessage = GeneralChatMessage::query()->create([
            'general_chat_conversation_id' => $conversation->id,
            'role' => 'user',
            'content' => $message,
            'attachments' => $attachments === [] ? null : $attachments,
            'usage' => null,
        ]);

        $needsTitle = ! $conversation->title || $conversation->title === 'New chat';
        $conversation->forceFill([
            'last_message_at' => now(),
            'title' => $needsTitle
                ? GeneralChatTitle::fromMessage($message, $attachments)
                : $conversation->title,
        ])->save();

        try {
            $result = $this->agent->chat($user, $message, $history, $attachments, $withMemory);
        } catch (Throwable $e) {
            $messageText = $e->getMessage();
            $timedOut = str_contains(strtolower($messageText), 'maximum execution time')
                || str_contains(strtolower($messageText), 'timed out')
                || str_contains(strtolower($messageText), 'curl error 28');

            $errorText = $timedOut
                ? 'Chat took too long to respond. Try a shorter question, or switch to a faster model in Settings → AI.'
                : $messageText;

            $assistantMessage = GeneralChatMessage::query()->create([
                'general_chat_conversation_id' => $conversation->id,
                'role' => 'assistant',
                'content' => $errorText,
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
                'conversation' => $this->serializeConversation($conversation->fresh(), $user),
                'user_message' => $this->serializeMessage($userMessage),
                'assistant_message' => $this->serializeMessage($assistantMessage),
                'usage' => null,
                'quota' => $this->quota->snapshot($user),
            ], $status);
        }

        $assistantMessage = GeneralChatMessage::query()->create([
            'general_chat_conversation_id' => $conversation->id,
            'role' => 'assistant',
            'content' => (string) ($result['message'] ?? ''),
            'usage' => is_array($result['usage'] ?? null) ? $result['usage'] : null,
        ]);
        $conversation->forceFill(['last_message_at' => now()])->save();

        if ($autoMemory) {
            try {
                $this->memories->extract($user, $message, (string) ($result['message'] ?? ''));
            } catch (Throwable) {
                // Memory extraction must not block the reply.
            }
        }

        if ($needsTitle) {
            try {
                $conversation->title = $this->agent->suggestTitle(
                    $user,
                    $message,
                    (string) ($result['message'] ?? ''),
                    $attachments,
                );
                $conversation->save();
            } catch (Throwable) {
                // Keep the heuristic title.
            }
        }

        return response()->json([
            'message' => $result['message'] ?? '',
            'conversation' => $this->serializeConversation($conversation->fresh(), $user),
            'user_message' => $this->serializeMessage($userMessage),
            'assistant_message' => $this->serializeMessage($assistantMessage),
            'usage' => $result['usage'] ?? null,
            'quota' => $this->quota->snapshot($user),
            'memories' => $this->memories->list($user),
            'auto_memory' => $user->generalChatAutoMemoryEnabled(),
        ]);
    }

    private function resolveConversation(User $user, mixed $conversationId): GeneralChatConversation|JsonResponse
    {
        if ($conversationId) {
            $conversation = GeneralChatConversation::query()->find($conversationId);
            if (! $conversation || (int) $conversation->user_id !== (int) $user->id) {
                return response()->json(['message' => 'Conversation not found.'], 404);
            }

            return $conversation;
        }

        return GeneralChatConversation::query()->create([
            'user_id' => $user->id,
            'title' => 'New chat',
            'last_message_at' => now(),
        ]);
    }

    private function authorizedUser(Request $request): User|JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! PermissionService::can($user, PermissionCatalog::GENERAL_CHAT_USE)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $user;
    }

    /**
     * @param  list<array{role?: string, content?: string}>  $clientHistory
     * @return list<array{role: string, content: mixed}>
     */
    private function historyForAgent(GeneralChatConversation $conversation, array $clientHistory): array
    {
        $stored = $conversation->messages()
            ->whereIn('role', ['user', 'assistant'])
            ->orderByDesc('id')
            ->limit(self::MAX_STORED_HISTORY)
            ->get(['role', 'content', 'attachments'])
            ->reverse()
            ->values()
            ->map(function (GeneralChatMessage $message) {
                $attachments = is_array($message->attachments) ? $message->attachments : [];
                $content = $attachments === []
                    ? (string) $message->content
                    : GeneralChatAttachments::toLlmContent((string) $message->content, $attachments);

                return [
                    'role' => (string) $message->role,
                    'content' => $content,
                ];
            })
            ->filter(fn (array $item) => $item['content'] !== '' && $item['content'] !== [])
            ->all();

        if ($stored !== []) {
            return array_values($stored);
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
     * @return array{id: int, title: string, pinned: bool, pinned_at: string|null, last_message_at: string|null, use_memory: bool|null, memory_active: bool}
     */
    private function serializeConversation(GeneralChatConversation $conversation, User $user): array
    {
        $auto = $user->generalChatAutoMemoryEnabled();

        return [
            'id' => (int) $conversation->id,
            'title' => (string) ($conversation->title ?: 'New chat'),
            'pinned' => $conversation->pinned_at !== null,
            'pinned_at' => optional($conversation->pinned_at)?->toIso8601String(),
            'last_message_at' => optional($conversation->last_message_at)?->toIso8601String(),
            'use_memory' => array_key_exists('use_memory', $conversation->getAttributes()) && $conversation->getAttributes()['use_memory'] !== null
                ? $conversation->usesMemory(false)
                : null,
            'memory_active' => $conversation->usesMemory($auto),
        ];
    }

    /**
     * @return array{id: int, role: string, content: string, attachments: list<mixed>, usage: array<string, mixed>|null, created_at: string|null}
     */
    private function serializeMessage(GeneralChatMessage $message): array
    {
        return [
            'id' => (int) $message->id,
            'role' => (string) $message->role,
            'content' => (string) $message->content,
            'attachments' => is_array($message->attachments) ? $message->attachments : [],
            'usage' => is_array($message->usage) ? $message->usage : null,
            'created_at' => optional($message->created_at)?->toIso8601String(),
        ];
    }
}
