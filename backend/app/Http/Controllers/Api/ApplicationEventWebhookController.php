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

        $mapper = app(NotificationEventMapperService::class);

        if (! $mapper->shouldAutoNotify($application)) {
            SystemEvent::create([
                'system_id' => $application->slug,
                'event_type' => 'webhook',
                'title' => $this->eventTitle($event),
                'payload' => $event,
                'status' => 'acknowledged',
            ]);

            return response()->json([
                'ok' => true,
                'notification' => null,
                'message' => 'Event received. Auto-create notifications is disabled.',
            ], 202);
        }

        try {
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

        $configOverride = $request->input('notification_config');
        $event = $request->input('event');

        if (! is_array($event)) {
            $event = $request->except('notification_config');
        }

        if (! is_array($event) || $event === []) {
            return response()->json(['message' => 'Invalid JSON body'], 400);
        }

        if ($configOverride !== null && ! is_array($configOverride)) {
            return response()->json(['message' => 'Invalid notification_config'], 400);
        }

        try {
            $payload = app(NotificationEventMapperService::class)->map(
                $application,
                $event,
                is_array($configOverride) ? $configOverride : null
            );

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

    /**
     * @param  array<string, mixed>  $event
     */
    private function eventTitle(array $event): string
    {
        foreach (['title', 'subject'] as $key) {
            $value = $event[$key] ?? null;

            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return 'Webhook event';
    }
}
