<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationSsoCredential;
use App\Support\ApiTokenAuth;
use App\Support\ApplicationSsoCredentials;
use App\Support\UserApplicationAccess;
use App\Services\ApplicationSsoCredentialNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ApplicationSsoCredentialController extends Controller
{
    public function index(Request $request, Application $application): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canViewApplication($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($application->auth_mode !== 'jwt') {
            return response()->json([
                'primary_email' => $user->email,
                'credentials' => [],
                'launch_options' => [],
            ]);
        }

        $credentials = ApplicationSsoCredentials::storedCredentials($user, $application)
            ->map(fn (ApplicationSsoCredential $credential) => [
                'id' => $credential->id,
                'email' => $credential->email,
                'label' => $credential->label,
                'status' => $credential->status,
                'reviewed_at' => $credential->reviewed_at?->toISOString(),
            ])
            ->values();

        return response()->json([
            'primary_email' => $user->email,
            'credentials' => $credentials,
            'launch_options' => ApplicationSsoCredentials::launchOptions($user, $application),
        ]);
    }

    public function store(Request $request, Application $application): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canViewApplication($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($application->auth_mode !== 'jwt') {
            return response()->json(['message' => 'SSO credentials are only supported for JWT applications.'], 422);
        }

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'label' => ['nullable', 'string', 'max:120'],
        ]);

        $email = strtolower(trim($validated['email']));
        $primaryEmail = strtolower(trim((string) ($user->email ?? '')));

        if ($primaryEmail !== '' && $email === $primaryEmail) {
            return response()->json([
                'message' => 'This email is already your Nexus account. Add a different SSO email instead.',
            ], 422);
        }

        $exists = ApplicationSsoCredential::query()
            ->where('user_id', $user->id)
            ->where('application_id', $application->id)
            ->whereRaw('LOWER(email) = ?', [$email])
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'This SSO email is already saved for this application.'], 422);
        }

        $credential = ApplicationSsoCredential::create([
            'user_id' => $user->id,
            'application_id' => $application->id,
            'email' => $validated['email'],
            'label' => isset($validated['label']) ? trim($validated['label']) : null,
            'status' => ApplicationSsoCredential::STATUS_PENDING,
        ]);

        app(ApplicationSsoCredentialNotificationService::class)->notifyAdminsOfPendingRequest($credential);

        return response()->json([
            'id' => $credential->id,
            'email' => $credential->email,
            'label' => $credential->label,
            'status' => $credential->status,
            'message' => 'SSO account submitted for admin approval.',
        ], 201);
    }

    public function destroy(Request $request, Application $application, ApplicationSsoCredential $ssoCredential): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canViewApplication($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (
            (int) $ssoCredential->application_id !== (int) $application->id
            || (int) $ssoCredential->user_id !== (int) $user->id
        ) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $ssoCredential->delete();

        return response()->json([], 204);
    }

    private function canViewApplication($user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        if ($application->visibility === 'private') {
            return (int) $application->created_by_user_id === (int) $user->id
                || $application->privateAccessEmails()->where('email', $user->email)->exists();
        }

        $allowedPublicSlugs = UserApplicationAccess::allowedPublicSlugs($user);

        if ($allowedPublicSlugs === null) {
            return true;
        }

        return in_array($application->slug, $allowedPublicSlugs, true);
    }
}
