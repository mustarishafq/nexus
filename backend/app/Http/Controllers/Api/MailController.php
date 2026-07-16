<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MailMailboxService;
use App\Support\ApiTokenAuth;
use Illuminate\Database\QueryException;
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

        $accounts = $this->mail->accountsFor($user)
            ->map(fn ($account) => $account->toMailboxArray())
            ->values()
            ->all();

        $connected = $accounts !== [];
        $activeId = $request->integer('account_id') ?: null;
        $active = null;

        if ($connected) {
            try {
                $active = $this->mail->resolveAccount($user, $activeId ?: null)->toMailboxArray();
            } catch (RuntimeException) {
                $active = $accounts[0] ?? null;
            }
        }

        return response()->json([
            'configured' => $this->mail->isServerConfigured(),
            'reachable' => $this->mail->isServerReachableForUser($user),
            'connected' => $connected,
            'email' => $active['email'] ?? $user->email,
            'account' => $active,
            'accounts' => $accounts,
            'folders' => collect(MailMailboxService::logicalFolders())
                ->map(fn (string $folder) => [
                    'id' => $folder,
                    'label' => match ($folder) {
                        MailMailboxService::FOLDER_INBOX => 'Inbox',
                        MailMailboxService::FOLDER_DRAFTS => 'Drafts',
                        MailMailboxService::FOLDER_SENT => 'Sent',
                        MailMailboxService::FOLDER_SPAM => 'Spam',
                        MailMailboxService::FOLDER_ARCHIVE => 'Archive',
                        default => ucfirst($folder),
                    },
                ])
                ->values()
                ->all(),
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
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'label' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        try {
            $account = $this->mail->testAndStoreCredentials(
                $user,
                $validated['password'],
                $validated['email'] ?? null,
                $validated['label'] ?? null,
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (QueryException $exception) {
            report($exception);

            return response()->json([
                'message' => 'Could not save this mailbox. If you already connected an account, try updating it or reconnecting after refreshing the page.',
            ], 422);
        }

        return response()->json([
            'connected' => true,
            'email' => $account->email,
            'account' => $account->toMailboxArray(),
            'accounts' => $this->mail->accountsFor($user)
                ->map(fn ($item) => $item->toMailboxArray())
                ->values()
                ->all(),
        ]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'account_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ]);

        try {
            $this->mail->disconnect($user, $validated['account_id'] ?? null);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $accounts = $this->mail->accountsFor($user)
            ->map(fn ($item) => $item->toMailboxArray())
            ->values()
            ->all();

        return response()->json([
            'connected' => $accounts !== [],
            'accounts' => $accounts,
        ]);
    }

    public function setPrimary(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'account_id' => ['required', 'integer', 'min:1'],
        ]);

        try {
            $account = $this->mail->setPrimaryAccount($user, (int) $validated['account_id']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'account' => $account->toMailboxArray(),
            'accounts' => $this->mail->accountsFor($user)
                ->map(fn ($item) => $item->toMailboxArray())
                ->values()
                ->all(),
        ]);
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
            'account_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'folder' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        try {
            $payload = $this->mail->listInbox(
                $user,
                (int) ($validated['limit'] ?? 50),
                $validated['q'] ?? null,
                (bool) ($validated['unread'] ?? false),
                true,
                isset($validated['account_id']) ? (int) $validated['account_id'] : null,
                $validated['folder'] ?? MailMailboxService::FOLDER_INBOX,
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

        $validated = $request->validate([
            'account_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'folder' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        try {
            $message = $this->mail->getMessage(
                $user,
                $uid,
                isset($validated['account_id']) ? (int) $validated['account_id'] : null,
                $validated['folder'] ?? MailMailboxService::FOLDER_INBOX,
            );
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
            'account_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'attachments' => ['sometimes', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:10240'],
        ]);

        $accountId = isset($validated['account_id']) ? (int) $validated['account_id'] : null;
        unset($validated['account_id']);
        $validated['attachments'] = $request->file('attachments', []);

        try {
            $this->mail->sendMessage($user, $validated, $accountId);
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

        $validated = $request->validate([
            'account_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'folder' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        try {
            $this->mail->deleteMessage(
                $user,
                $uid,
                isset($validated['account_id']) ? (int) $validated['account_id'] : null,
                $validated['folder'] ?? MailMailboxService::FOLDER_INBOX,
            );
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

        $validated = $request->validate([
            'account_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'folder' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        try {
            $this->mail->markUnread(
                $user,
                $uid,
                isset($validated['account_id']) ? (int) $validated['account_id'] : null,
                $validated['folder'] ?? MailMailboxService::FOLDER_INBOX,
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (Throwable) {
            return response()->json(['message' => 'Unable to update message.'], 500);
        }

        return response()->json(['seen' => false]);
    }
}
