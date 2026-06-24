<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\SystemEvent;
use App\Models\User;
use App\Services\CalendarEventIntegrationService;
use App\Services\CalendarEventMapperService;
use App\Support\ApiTokenAuth;
use App\Support\CalendarEventMapping;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Throwable;

class ApplicationCalendarWebhookController extends Controller
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

        $mapper = app(CalendarEventMapperService::class);

        if (! $mapper->shouldAutoSync($application)) {
            SystemEvent::create([
                'system_id' => $application->slug,
                'event_type' => 'webhook',
                'title' => $this->eventTitle($event),
                'payload' => $event,
                'status' => 'acknowledged',
            ]);

            return response()->json([
                'ok' => true,
                'calendar_event' => null,
                'message' => 'Event received. Auto-sync calendar is disabled.',
            ], 202);
        }

        try {
            $result = app(CalendarEventIntegrationService::class)->processWebhookEvent($application, $event);

            SystemEvent::create([
                'system_id' => $application->slug,
                'event_type' => 'webhook',
                'title' => $result['calendar_event']?->title ?? $this->eventTitle($event),
                'payload' => $event,
                'status' => 'processed',
            ]);

            return response()->json([
                'ok' => true,
                'action' => $result['action'],
                'notify_action' => $result['notify_action'],
                'calendar_event' => $result['calendar_event'],
            ], $result['action'] === 'created' ? 201 : 200);
        } catch (InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (Throwable) {
            return response()->json([
                'message' => 'Failed to sync calendar event from webhook.',
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

        $configOverride = $request->input('calendar_config');
        $event = $request->input('event');

        if (! is_array($event)) {
            $event = $request->except('calendar_config');
        }

        if (! is_array($event) || $event === []) {
            return response()->json(['message' => 'Invalid JSON body'], 400);
        }

        if ($configOverride !== null && ! is_array($configOverride)) {
            return response()->json(['message' => 'Invalid calendar_config'], 400);
        }

        try {
            $payload = app(CalendarEventMapperService::class)->map(
                $application,
                $event,
                is_array($configOverride) ? $configOverride : null
            );

            if (isset($payload['start_at']) && $payload['start_at'] instanceof \Illuminate\Support\Carbon) {
                $payload['start_at'] = $payload['start_at']->toISOString();
            }

            if (isset($payload['end_at']) && $payload['end_at'] instanceof \Illuminate\Support\Carbon) {
                $payload['end_at'] = $payload['end_at']->toISOString();
            }

            return response()->json(['payload' => $payload]);
        } catch (InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (Throwable) {
            return response()->json([
                'message' => 'Failed to preview calendar event mapping.',
            ], 502);
        }
    }

    private function authorizeIncoming(Request $request, Application $application): ?JsonResponse
    {
        $config = CalendarEventMapping::normalize($application->calendar_config);
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

    /**
     * @param  array<string, mixed>  $event
     */
    private function eventTitle(array $event): string
    {
        foreach (['title', 'subject', 'summary'] as $key) {
            $value = $event[$key] ?? null;

            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return 'Calendar webhook event';
    }
}
