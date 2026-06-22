<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApplicationSsoCredential;
use App\Support\ApiTokenAuth;
use App\Services\ApplicationSsoCredentialNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ApplicationSsoCredentialAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'status' => ['nullable', 'string', Rule::in([
                ApplicationSsoCredential::STATUS_PENDING,
                ApplicationSsoCredential::STATUS_APPROVED,
                ApplicationSsoCredential::STATUS_REJECTED,
            ])],
        ]);

        $status = $validated['status'] ?? ApplicationSsoCredential::STATUS_PENDING;

        $items = ApplicationSsoCredential::query()
            ->with(['user:id,name,full_name,email', 'application:id,name,slug', 'reviewer:id,name,full_name,email'])
            ->where('status', $status)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (ApplicationSsoCredential $credential) => $this->serializeCredential($credential));

        return response()->json([
            'items' => $items,
            'status' => $status,
        ]);
    }

    public function update(Request $request, ApplicationSsoCredential $ssoCredential): JsonResponse
    {
        $admin = ApiTokenAuth::userFromRequest($request);

        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in([
                ApplicationSsoCredential::STATUS_APPROVED,
                ApplicationSsoCredential::STATUS_REJECTED,
            ])],
        ]);

        $ssoCredential->update([
            'status' => $validated['status'],
            'reviewed_by_user_id' => $admin->id,
            'reviewed_at' => now(),
        ]);

        app(ApplicationSsoCredentialNotificationService::class)->notifyUserOfReview(
            $ssoCredential->fresh()
        );

        return response()->json(
            $this->serializeCredential($ssoCredential->fresh()->load(['user:id,name,full_name,email', 'application:id,name,slug', 'reviewer:id,name,full_name,email']))
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCredential(ApplicationSsoCredential $credential): array
    {
        $user = $credential->user;
        $application = $credential->application;
        $reviewer = $credential->reviewer;

        return [
            'id' => $credential->id,
            'email' => $credential->email,
            'label' => $credential->label,
            'status' => $credential->status,
            'created_at' => $credential->created_at?->toISOString(),
            'reviewed_at' => $credential->reviewed_at?->toISOString(),
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->full_name ?: $user->name ?: $user->email,
                'email' => $user->email,
            ] : null,
            'application' => $application ? [
                'id' => $application->id,
                'name' => $application->name,
                'slug' => $application->slug,
            ] : null,
            'reviewer' => $reviewer ? [
                'id' => $reviewer->id,
                'name' => $reviewer->full_name ?: $reviewer->name ?: $reviewer->email,
            ] : null,
        ];
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }
}
