<?php

namespace App\Services;

use App\Models\ApplicationSsoCredential;
use App\Models\Notification;
use App\Models\User;

class ApplicationSsoCredentialNotificationService
{
    public function notifyAdminsOfPendingRequest(ApplicationSsoCredential $credential): void
    {
        $credential->loadMissing(['user', 'application']);

        $requester = $credential->user;
        $application = $credential->application;

        if (! $requester || ! $application) {
            return;
        }

        $requesterName = $requester->displayName();
        $accountLabel = trim((string) $credential->label) ?: $credential->email;

        $admins = User::query()
            ->where('role', 'admin')
            ->where('is_approved', true)
            ->get(['id']);

        foreach ($admins as $admin) {
            $notification = Notification::create([
                'user_id' => (string) $admin->id,
                'system_id' => $application->slug,
                'type' => 'info',
                'priority' => 'medium',
                'category' => 'approval',
                'title' => 'SSO account approval needed',
                'message' => "{$requesterName} requested {$accountLabel} ({$credential->email}) for {$application->name}.",
                'action_url' => '/admin/users?section=sso-links',
                'is_read' => false,
                'is_broadcast' => false,
                'delivery_channels' => ['in_app'],
                'data' => [
                    'kind' => 'sso_credential_pending',
                    'credential_id' => $credential->id,
                    'application_id' => $application->id,
                    'application_name' => $application->name,
                    'requested_email' => $credential->email,
                    'requester_user_id' => $requester->id,
                    'requester_name' => $requesterName,
                    'admin_section' => 'sso-links',
                ],
            ]);

            app(PushNotificationService::class)->sendNotification($notification);
        }
    }

    public function notifyUserOfReview(ApplicationSsoCredential $credential): void
    {
        $credential->loadMissing(['user', 'application', 'reviewer']);

        $user = $credential->user;
        $application = $credential->application;

        if (! $user || ! $application) {
            return;
        }

        $accountLabel = trim((string) $credential->label) ?: $credential->email;
        $reviewerName = $credential->reviewer?->displayName() ?? 'An admin';
        $approved = $credential->status === ApplicationSsoCredential::STATUS_APPROVED;

        $notification = Notification::create([
            'user_id' => (string) $user->id,
            'system_id' => $application->slug,
            'type' => $approved ? 'success' : 'warning',
            'priority' => 'medium',
            'category' => 'approval',
            'title' => $approved ? 'SSO account approved' : 'SSO account rejected',
            'message' => $approved
                ? "{$reviewerName} approved {$accountLabel} for {$application->name}."
                : "{$reviewerName} rejected {$accountLabel} for {$application->name}.",
            'action_url' => '/applications',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
            'data' => [
                'kind' => $approved ? 'sso_credential_approved' : 'sso_credential_rejected',
                'credential_id' => $credential->id,
                'application_id' => $application->id,
                'application_name' => $application->name,
                'requested_email' => $credential->email,
                'reviewer_user_id' => $credential->reviewed_by_user_id,
                'reviewer_name' => $reviewerName,
            ],
        ]);

        app(PushNotificationService::class)->sendNotification($notification);
    }
}
