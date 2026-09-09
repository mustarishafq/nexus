<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LlmUsageLog;
use App\Services\PermissionService;
use App\Support\ApiTokenAuth;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LlmUsageLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! PermissionService::can($user, PermissionCatalog::SETTINGS_MANAGE)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'feature' => ['sometimes', 'nullable', 'string', 'max:64'],
            'application_slug' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 25);

        $query = LlmUsageLog::query()
            ->with(['user:id,name,full_name,email'])
            ->latest('id');

        if (! empty($validated['feature'])) {
            $query->where('feature', $validated['feature']);
        }

        if (! empty($validated['application_slug'])) {
            $query->where('application_slug', $validated['application_slug']);
        }

        $paginator = $query->paginate($perPage);

        $summaryRow = LlmUsageLog::query()
            ->when(! empty($validated['feature']), fn ($q) => $q->where('feature', $validated['feature']))
            ->when(! empty($validated['application_slug']), fn ($q) => $q->where('application_slug', $validated['application_slug']))
            ->selectRaw('
                COUNT(*) as requests,
                COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
                COALESCE(SUM(completion_tokens), 0) as completion_tokens,
                COALESCE(SUM(total_tokens), 0) as total_tokens,
                COALESCE(SUM(cost), 0) as cost
            ')
            ->first();

        $summary = [
            'requests' => (int) ($summaryRow->requests ?? 0),
            'prompt_tokens' => (int) ($summaryRow->prompt_tokens ?? 0),
            'completion_tokens' => (int) ($summaryRow->completion_tokens ?? 0),
            'total_tokens' => (int) ($summaryRow->total_tokens ?? 0),
            'cost' => (float) ($summaryRow->cost ?? 0),
        ];

        return response()->json([
            'summary' => $summary,
            'logs' => $paginator->getCollection()->map(fn (LlmUsageLog $log) => $this->serialize($log))->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(LlmUsageLog $log): array
    {
        $user = $log->user;

        return [
            'id' => $log->id,
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->full_name ?: $user->name ?: $user->email,
                'email' => $user->email,
            ] : null,
            'provider' => $log->provider,
            'model' => $log->model,
            'feature' => $log->feature,
            'application_slug' => $log->application_slug,
            'prompt_tokens' => $log->prompt_tokens,
            'completion_tokens' => $log->completion_tokens,
            'total_tokens' => $log->total_tokens,
            'reasoning_tokens' => $log->reasoning_tokens,
            'cached_tokens' => $log->cached_tokens,
            'cost' => $log->cost,
            'upstream_cost' => $log->upstream_cost,
            'generation_id' => $log->generation_id,
            'request_count' => $log->request_count,
            'ok' => $log->ok,
            'error_message' => $log->error_message,
            'input_text' => $log->input_text,
            'output_text' => $log->output_text,
            'metadata' => $log->metadata,
            'created_at' => $log->created_at?->toISOString(),
        ];
    }
}
