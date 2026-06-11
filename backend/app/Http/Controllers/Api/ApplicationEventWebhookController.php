<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\SystemEvent;
use App\Models\User;
use App\Services\NotificationEventMapperService;
use App\Support\ApiTokenAuth;
use App\Support\NotificationEventMapping;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Throwable;

class ApplicationEventWebhookController extends Controller
{
    public function store(Request $request, Application $application): JsonResponse
    {
        if ($response = $this->authorizeIncoming($request, $application)) {
            return $response;
        }

        $event = $request->all();

        if (! is_array($event) || $event === []) {
            return response()->json(['message' => 'Invalid JSON body'], 400);
        }

        try {
            $mapper = app(NotificationEventMapperService::class);
            $notification = $mapper->createNotification($application, $event);

            SystemEvent::create([
                'system_id' => $application->slug,
                'event_type' => 'webhook',
                'title' => $notification->title,
                'payload' => $event,
                'status' => 'processed',
                'severity' => $this->severityFromNotification($notification),
            ]);

            return response()->json([
                'ok' => true,
                'notification' => $notification,
            ], 201);
        } catch (InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (Throwable $exception) {
            return response()->json([
                'message' => 'Failed to create notification from event.',
            ], 502);
        }
    }

    public function preview(Request $request, Application $application): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canEditSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $event = $request->all();

        if (! is_array($event) || $event === []) {
            return response()->json(['message' => 'Invalid JSON body'], 400);
        }

        try {
            $payload = app(NotificationEventMapperService::class)->map($application, $event);

            return response()->json(['payload' => $payload]);
        } catch (InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    private function authorizeIncoming(Request $request, Application $application): ?JsonResponse
    {
        $config = NotificationEventMapping::normalize($application->notification_config);
        $secret = $config['webhook_secret'];

        if ($secret && hash_equals($secret, (string) $request->header('X-Webhook-Secret', ''))) {
            return null;
        }

        $user = ApiTokenAuth::userFromRequest($request);

        if ($user && $this->canEditSystem($user, $application)) {
            return null;
        }

        return response()->json(['message' => 'Unauthorized'], 401);
    }

    private function canEditSystem(User $user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return (int) $application->created_by_user_id === (int) $user->id;
    }

    private function severityFromNotification($notification): int
    {
        return match ($notification->priority) {
            'critical' => 10,
            'high' => 7,
            'medium' => 5,
            default => 3,
        };
    }
}
