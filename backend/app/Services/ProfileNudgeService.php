<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use App\Support\ProfileCompleteness;
use Illuminate\Support\Carbon;

class ProfileNudgeService
{
    public const COOLDOWN_HOURS = 24;

    /**
     * @return array{sent: bool, reason?: string, notification?: Notification, completeness?: array<string, mixed>}
     */
    public function nudge(User $user, User $admin, bool $force = false): array
    {
        $completeness = ProfileCompleteness::forUser($user);

        if ($completeness['percent'] >= 100) {
            return [
                'sent' => false,
                'reason' => 'Profile is already complete.',
                'completeness' => $completeness,
            ];
        }

        if (! $user->is_approved) {
            return [
                'sent' => false,
                'reason' => 'User is not approved yet.',
                'completeness' => $completeness,
            ];
        }

        if (! $force && $this->isOnCooldown($user)) {
            return [
                'sent' => false,
                'reason' => 'A profile reminder was sent recently. Try again later.',
                'completeness' => $completeness,
            ];
        }

        $percent = $completeness['percent'];
        $adminName = $admin->displayName();

        $notification = Notification::create([
            'user_id' => (string) $user->id,
            'type' => 'info',
            'priority' => 'medium',
            'category' => 'hr',
            'title' => 'Complete your profile',
            'message' => "Your profile is {$percent}% complete. Add the missing details to help colleagues find and connect with you.",
            'action_url' => '/profile',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
            'data' => [
                'kind' => 'profile_nudge',
                'completeness' => $completeness,
                'nudged_by_user_id' => $admin->id,
                'nudged_by_name' => $adminName,
            ],
        ]);

        $user->forceFill(['last_profile_nudge_at' => now()])->save();

        app(PushNotificationService::class)->sendNotification($notification);

        return [
            'sent' => true,
            'notification' => $notification,
            'completeness' => $completeness,
        ];
    }

    /**
     * @return array{sent: int, skipped: int, errors: list<string>}
     */
    public function nudgeIncompleteUsers(User $admin, bool $force = false): array
    {
        $users = User::query()
            ->with(['department', 'educations', 'workExperiences'])
            ->where('is_approved', true)
            ->where('role', '!=', 'admin')
            ->get();

        $sent = 0;
        $skipped = 0;
        $errors = [];

        foreach ($users as $user) {
            $result = $this->nudge($user, $admin, $force);

            if ($result['sent']) {
                $sent++;
                continue;
            }

            if (($result['reason'] ?? '') === 'Profile is already complete.') {
                $skipped++;
                continue;
            }

            if (($result['reason'] ?? '') === 'A profile reminder was sent recently. Try again later.') {
                $skipped++;
                continue;
            }

            $errors[] = "{$user->email}: {$result['reason']}";
        }

        return [
            'sent' => $sent,
            'skipped' => $skipped,
            'errors' => $errors,
        ];
    }

    private function isOnCooldown(User $user): bool
    {
        if (! $user->last_profile_nudge_at) {
            return false;
        }

        return Carbon::parse($user->last_profile_nudge_at)->greaterThan(now()->subHours(self::COOLDOWN_HOURS));
    }
}
