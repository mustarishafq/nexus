<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesMessages;
use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\MessageReaction;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MessageReactionController extends Controller
{
    use SerializesFeedAuthors;
    use SerializesMessages;

    public function store(Request $request, Message $message): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensureMessageIsInteractable($message, $viewer)) {
            return $response;
        }

        $validated = $request->validate([
            'reaction' => ['required', 'string', 'max:16', Rule::in(self::MESSAGE_ALLOWED_REACTIONS)],
        ]);

        $existing = MessageReaction::query()
            ->where('message_id', $message->id)
            ->where('user_id', $viewer->id)
            ->first();

        if ($existing && $existing->reaction === $validated['reaction']) {
            $existing->delete();
        } else {
            MessageReaction::query()->updateOrCreate(
                [
                    'message_id' => $message->id,
                    'user_id' => $viewer->id,
                ],
                [
                    'reaction' => $validated['reaction'],
                ]
            );
        }

        $message->load(['sender.department', 'reactions']);

        return response()->json([
            'message' => $this->serializeMessage($message, $viewer),
        ]);
    }

    public function destroy(Request $request, Message $message): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensureMessageIsInteractable($message, $viewer)) {
            return $response;
        }

        MessageReaction::query()
            ->where('message_id', $message->id)
            ->where('user_id', $viewer->id)
            ->delete();

        $message->load(['sender.department', 'reactions']);

        return response()->json([
            'message' => $this->serializeMessage($message, $viewer),
        ]);
    }

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }

    /**
     * A reaction mutation is only allowed for an approved user who
     * participates in the message's conversation, on a message that has
     * not been tombstoned.
     */
    private function ensureMessageIsInteractable(Message $message, User $viewer): ?JsonResponse
    {
        $message->loadMissing('conversation.participants');
        $conversation = $message->conversation;

        if (! $conversation) {
            return response()->json(['message' => 'Message not found.'], 404);
        }

        $isParticipant = $conversation->participants->contains('id', $viewer->id);
        if (! $isParticipant) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($message->deleted_at !== null) {
            return response()->json(['message' => 'This message has been deleted.'], 422);
        }

        return null;
    }
}
