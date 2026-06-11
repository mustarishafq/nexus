<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\SystemEvent;
use App\Services\NotificationEventMapperService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Throwable;

class SystemEventController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $items = $this->applyIndexQuery(
            $request,
            SystemEvent::query(),
            ['system_id', 'event_type', 'status']
        )->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'system_id' => ['required', 'string', 'max:255'],
            'event_type' => ['sometimes', Rule::in(['info', 'warning', 'error', 'critical', 'health_check', 'webhook'])],
            'title' => ['required', 'string', 'max:255'],
            'payload' => ['nullable', 'array'],
            'status' => ['sometimes', Rule::in(['pending', 'processed', 'failed', 'acknowledged'])],
            'severity' => ['nullable', 'integer', 'between:1,10'],
        ]);

        $item = SystemEvent::create($validated);

        $this->maybeCreateNotification($item, $validated);

        return response()->json($item, 201);
    }

    public function show(SystemEvent $systemEvent): JsonResponse
    {
        return response()->json($systemEvent);
    }

    public function update(Request $request, SystemEvent $systemEvent): JsonResponse
    {
        $validated = $request->validate([
            'system_id' => ['sometimes', 'string', 'max:255'],
            'event_type' => ['sometimes', Rule::in(['info', 'warning', 'error', 'critical', 'health_check', 'webhook'])],
            'title' => ['sometimes', 'string', 'max:255'],
            'payload' => ['sometimes', 'nullable', 'array'],
            'status' => ['sometimes', Rule::in(['pending', 'processed', 'failed', 'acknowledged'])],
            'severity' => ['sometimes', 'nullable', 'integer', 'between:1,10'],
        ]);

        $systemEvent->update($validated);

        return response()->json($systemEvent->fresh());
    }

    public function destroy(SystemEvent $systemEvent): JsonResponse
    {
        $systemEvent->delete();

        return response()->json(status: 204);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function maybeCreateNotification(SystemEvent $item, array $validated): void
    {
        $application = Application::query()
            ->where('slug', $item->system_id)
            ->first();

        if (! $application) {
            return;
        }

        $mapper = app(NotificationEventMapperService::class);

        if (! $mapper->shouldAutoNotify($application)) {
            return;
        }

        $source = array_merge(
            (array) ($validated['payload'] ?? []),
            Arr::except($validated, ['payload', 'status'])
        );

        try {
            $mapper->createNotification($application, $source);
            $item->update(['status' => 'processed']);
        } catch (InvalidArgumentException|Throwable) {
            $item->update(['status' => 'failed']);
        }
    }
}
