<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MailMailboxService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Throwable;

class MailController extends Controller
{
    public function __construct(
        protected MailMailboxService $mail,
    ) {}

    public function status(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $connected = $this->mail->hasCredentials($user);

        return response()->json([
            'configured' => $this->mail->isServerConfigured(),
            'reachable' => $this->mail->isServerReachableForUser($user),
            'connected' => $connected,
            'email' => $user->email,
        ]);
    }

    public function connect(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'password' => ['required', 'string', 'max:2048'],
        ]);

        try {
            $this->mail->testAndStoreCredentials($user, $validated['password']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'connected' => true,
            'email' => $user->email,
        ]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $this->mail->disconnect($user);

        return response()->json(['connected' => false]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'q' => ['sometimes', 'nullable', 'string', 'max:200'],
            'unread' => ['sometimes', 'boolean'],
        ]);

        try {
            $payload = $this->mail->listInbox(
                $user,
                (int) ($validated['limit'] ?? 50),
                $validated['q'] ?? null,
                (bool) ($validated['unread'] ?? false),
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (Throwable) {
            return response()->json(['message' => 'Unable to load mailbox.'], 500);
        }

        return response()->json($payload);
    }

    public function show(Request $request, int $uid): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        try {
            $message = $this->mail->getMessage($user, $uid);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (Throwable) {
            return response()->json(['message' => 'Unable to load message.'], 500);
        }

        return response()->json($message);
    }

    public function send(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'to' => ['required', 'string', 'max:2000'],
            'subject' => ['required', 'string', 'max:500'],
            'body' => ['required', 'string', 'max:50000'],
            'cc' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'bcc' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'in_reply_to' => ['sometimes', 'nullable', 'string', 'max:500'],
            'references' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'attachments' => ['sometimes', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:10240'],
        ]);

        $validated['attachments'] = $request->file('attachments', []);

        try {
            $this->mail->sendMessage($user, $validated);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (Throwable) {
            return response()->json(['message' => 'Unable to send email.'], 500);
        }

        return response()->json(['sent' => true]);
    }

    public function destroy(Request $request, int $uid): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        try {
            $this->mail->deleteMessage($user, $uid);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (Throwable) {
            return response()->json(['message' => 'Unable to delete message.'], 500);
        }

        return response()->json(['deleted' => true]);
    }

    public function markUnread(Request $request, int $uid): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        try {
            $this->mail->markUnread($user, $uid);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (Throwable) {
            return response()->json(['message' => 'Unable to update message.'], 500);
        }

        return response()->json(['seen' => false]);
    }
}
