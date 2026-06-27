<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Collection;
use App\Services\DirectMessageNotifier;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConversationController extends Controller
{
    use SerializesFeedAuthors;

    public function index(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $conversations = Conversation::query()
            ->whereHas('participants', fn ($query) => $query->where('users.id', $viewer->id))
            ->whereHas('messages')
            ->with([
                'participants.department',
                'messages' => fn ($query) => $query->latest()->limit(1)->with('sender.department'),
            ])
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get();

        $unreadCounts = $this->unreadCountsForViewer($conversations, $viewer);

        $conversations = $conversations
            ->map(fn (Conversation $conversation) => $this->serializeConversation(
                $conversation,
                $viewer,
                (int) ($unreadCounts[$conversation->id] ?? 0),
            ))
            ->values();

        return response()->json([
            'conversations' => $conversations,
            'unread_total' => $conversations->sum('unread_count'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'recipient_user_id' => ['required', 'integer', 'exists:users,id'],
            'body' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        if ((int) $validated['recipient_user_id'] === $viewer->id) {
            return response()->json(['message' => 'You cannot message yourself.'], 422);
        }

        $recipient = User::query()
            ->with('department')
            ->where('is_approved', true)
            ->find($validated['recipient_user_id']);

        if (! $recipient) {
            return response()->json(['message' => 'Recipient not found.'], 404);
        }

        $body = trim((string) ($validated['body'] ?? ''));
        $existing = $this->findDirectConversation($viewer, $recipient);

        if ($body !== '') {
            $conversation = $existing ?? $this->createDirectConversation($viewer, $recipient);
            $conversation->load('participants');

            $message = DB::transaction(function () use ($conversation, $viewer, $body) {
                $message = $conversation->messages()->create([
                    'sender_user_id' => $viewer->id,
                    'body' => $body,
                ]);

                $conversation->update(['last_message_at' => now()]);
                $conversation->participants()->updateExistingPivot($viewer->id, ['last_read_at' => now()]);

                return $message;
            });

            $message->load('sender.department');

            app(DirectMessageNotifier::class)->notifyRecipient($viewer, $recipient, $conversation, $message);

            $conversation->load([
                'participants.department',
                'messages' => fn ($query) => $query->latest()->limit(1)->with('sender.department'),
            ]);

            return response()->json([
                'conversation' => $this->serializeConversation($conversation, $viewer),
                'message' => $this->serializeMessage($message, $viewer),
            ], $existing ? 200 : 201);
        }

        if ($existing && $existing->messages()->exists()) {
            $existing->load([
                'participants.department',
                'messages' => fn ($query) => $query->latest()->limit(1)->with('sender.department'),
            ]);

            return response()->json([
                'conversation' => $this->serializeConversation($existing, $viewer),
            ]);
        }

        return response()->json([
            'conversation' => null,
            'recipient_user' => $this->serializeFeedAuthor($recipient),
        ]);
    }

    public function messages(Request $request, Conversation $conversation): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer || ! $this->participant($conversation, $viewer)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $conversation->load('participants');

        $messages = $conversation->messages()
            ->with('sender.department')
            ->orderBy('created_at')
            ->limit(100)
            ->get()
            ->map(fn (Message $message) => $this->serializeMessage($message, $viewer))
            ->values();

        $this->markConversationRead($conversation, $viewer);

        return response()->json([
            'messages' => $messages,
            'conversation' => $this->serializeConversation($conversation->fresh(['participants']), $viewer),
        ]);
    }

    public function sendMessage(Request $request, Conversation $conversation): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer || ! $this->participant($conversation, $viewer)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $conversation->load('participants');

        $message = DB::transaction(function () use ($conversation, $viewer, $validated) {
            $message = $conversation->messages()->create([
                'sender_user_id' => $viewer->id,
                'body' => trim($validated['body']),
            ]);

            $conversation->update(['last_message_at' => now()]);
            $conversation->participants()->updateExistingPivot($viewer->id, ['last_read_at' => now()]);

            return $message;
        });

        $message->load('sender');

        $recipient = $conversation->participants
            ->first(fn (User $user) => (int) $user->id !== (int) $viewer->id);

        if ($recipient) {
            app(DirectMessageNotifier::class)->notifyRecipient($viewer, $recipient, $conversation, $message);
        }

        return response()->json([
            'message' => $this->serializeMessage($message, $viewer),
        ], 201);
    }

    public function markRead(Request $request, Conversation $conversation): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer || ! $this->participant($conversation, $viewer)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->markConversationRead($conversation, $viewer);

        return response()->json([
            'conversation' => $this->serializeConversation($conversation->fresh(['participants']), $viewer),
        ]);
    }

    public function destroy(Request $request, Conversation $conversation): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer || ! $this->participant($conversation, $viewer)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $conversation->delete();

        return response()->json(null, 204);
    }

    private function findDirectConversation(User $viewer, User $recipient): ?Conversation
    {
        return Conversation::query()
            ->where('type', 'direct')
            ->whereHas('participants', fn ($query) => $query->where('users.id', $viewer->id))
            ->whereHas('participants', fn ($query) => $query->where('users.id', $recipient->id))
            ->first();
    }

    private function createDirectConversation(User $viewer, User $recipient): Conversation
    {
        return DB::transaction(function () use ($viewer, $recipient) {
            $conversation = Conversation::create([
                'type' => 'direct',
            ]);

            $conversation->participants()->attach([
                $viewer->id => ['last_read_at' => now()],
                $recipient->id => ['last_read_at' => null],
            ]);

            return $conversation;
        });
    }

    private function participant(Conversation $conversation, User $viewer): bool
    {
        if ($conversation->relationLoaded('participants')) {
            return $conversation->participants->contains('id', $viewer->id);
        }

        return $conversation->participants()->where('users.id', $viewer->id)->exists();
    }

    private function markConversationRead(Conversation $conversation, User $viewer): void
    {
        $conversation->participants()->updateExistingPivot($viewer->id, [
            'last_read_at' => now(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * @param  Collection<int, Conversation>  $conversations
     * @return array<int, int>
     */
    private function unreadCountsForViewer(Collection $conversations, User $viewer): array
    {
        if ($conversations->isEmpty()) {
            return [];
        }

        return Message::query()
            ->selectRaw('messages.conversation_id, COUNT(*) as unread_count')
            ->join('conversation_participants', function ($join) use ($viewer) {
                $join->on('conversation_participants.conversation_id', '=', 'messages.conversation_id')
                    ->where('conversation_participants.user_id', '=', $viewer->id);
            })
            ->whereIn('messages.conversation_id', $conversations->pluck('id'))
            ->where('messages.sender_user_id', '!=', $viewer->id)
            ->where(function ($query) {
                $query->whereNull('conversation_participants.last_read_at')
                    ->orWhereColumn('messages.created_at', '>', 'conversation_participants.last_read_at');
            })
            ->groupBy('messages.conversation_id')
            ->pluck('unread_count', 'conversation_id')
            ->map(fn ($count) => (int) $count)
            ->all();
    }

    private function serializeConversation(Conversation $conversation, User $viewer, ?int $unreadCount = null): array
    {
        if (! $conversation->relationLoaded('participants')) {
            $conversation->load('participants');
        }

        $other = $conversation->participants
            ->first(fn (User $user) => (int) $user->id !== (int) $viewer->id);

        if ($unreadCount === null) {
            $pivot = $conversation->participants
                ->firstWhere('id', $viewer->id)?->pivot;

            $lastReadAt = $pivot?->last_read_at;

            $unreadCount = $conversation->messages()
                ->where('sender_user_id', '!=', $viewer->id)
                ->when($lastReadAt, fn ($query) => $query->where('created_at', '>', $lastReadAt))
                ->count();
        }

        $latestMessage = $conversation->relationLoaded('messages')
            ? $conversation->messages->first()
            : $conversation->messages()->latest()->with('sender')->first();

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'other_user' => $other ? $this->serializeFeedAuthor($other) : null,
            'last_message' => $latestMessage ? $this->serializeMessage($latestMessage, $viewer) : null,
            'unread_count' => $unreadCount,
            'last_message_at' => $conversation->last_message_at?->toISOString(),
            'updated_date' => $conversation->updated_date,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeMessage(Message $message, User $viewer): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'body' => $message->body,
            'sender' => $this->serializeFeedAuthor($message->sender),
            'created_date' => $message->created_date,
            'is_mine' => (int) $message->sender_user_id === (int) $viewer->id,
        ];
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
