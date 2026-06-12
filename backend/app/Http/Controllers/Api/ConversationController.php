<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
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
            ->with([
                'participants.department',
                'messages' => fn ($query) => $query->latest()->limit(1)->with('sender.department'),
            ])
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(fn (Conversation $conversation) => $this->serializeConversation($conversation, $viewer))
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
        ]);

        if ((int) $validated['recipient_user_id'] === $viewer->id) {
            return response()->json(['message' => 'You cannot message yourself.'], 422);
        }

        $recipient = User::query()
            ->where('is_approved', true)
            ->find($validated['recipient_user_id']);

        if (! $recipient) {
            return response()->json(['message' => 'Recipient not found.'], 404);
        }

        $conversation = $this->findOrCreateDirectConversation($viewer, $recipient);
        $conversation->load([
            'participants.department',
            'messages' => fn ($query) => $query->latest()->limit(1)->with('sender.department'),
        ]);

        return response()->json([
            'conversation' => $this->serializeConversation($conversation, $viewer),
        ], 201);
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

    private function findOrCreateDirectConversation(User $viewer, User $recipient): Conversation
    {
        $existing = Conversation::query()
            ->where('type', 'direct')
            ->whereHas('participants', fn ($query) => $query->where('users.id', $viewer->id))
            ->whereHas('participants', fn ($query) => $query->where('users.id', $recipient->id))
            ->first();

        if ($existing) {
            return $existing;
        }

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
    private function serializeConversation(Conversation $conversation, User $viewer): array
    {
        if (! $conversation->relationLoaded('participants')) {
            $conversation->load('participants');
        }

        $other = $conversation->participants
            ->first(fn (User $user) => (int) $user->id !== (int) $viewer->id);

        $pivot = $conversation->participants
            ->firstWhere('id', $viewer->id)?->pivot;

        $lastReadAt = $pivot?->last_read_at;

        $unreadCount = $conversation->messages()
            ->where('sender_user_id', '!=', $viewer->id)
            ->when($lastReadAt, fn ($query) => $query->where('created_at', '>', $lastReadAt))
            ->count();

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
