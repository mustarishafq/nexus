<?php

namespace App\Support;

use App\Models\AccessGroup;
use App\Models\Application;
use App\Models\Broadcast;
use App\Models\CalendarEvent;
use App\Models\MetabaseDashboard;
use App\Models\UserSystemAccess;

class SyncAssignmentRecords
{
    /**
     * @param  array<int, string>|null  $slugs
     */
    public static function syncAccessGroupApplications(AccessGroup $group, ?array $slugs): void
    {
        $group->allowedApplications()->detach();

        if ($slugs === null || $slugs === []) {
            return;
        }

        $applicationIds = Application::query()
            ->whereIn('slug', self::normalizeSlugs($slugs))
            ->where('visibility', 'public')
            ->pluck('id')
            ->all();

        if ($applicationIds !== []) {
            $group->allowedApplications()->sync($applicationIds);
        }
    }

    /**
     * @param  array<int, string>|null  $slugs
     */
    public static function syncUserSystemAccessApplications(UserSystemAccess $record, ?array $slugs): void
    {
        $record->allowedApplications()->detach();

        if ($slugs === null || $slugs === []) {
            return;
        }

        $applicationIds = Application::query()
            ->whereIn('slug', self::normalizeSlugs($slugs))
            ->where('visibility', 'public')
            ->pluck('id')
            ->all();

        if ($applicationIds !== []) {
            $record->allowedApplications()->sync($applicationIds);
        }
    }

    /**
     * @param  array<int, string>|null  $emails
     */
    public static function syncApplicationPrivateEmails(Application $application, ?array $emails): void
    {
        $application->privateAccessEmails()->delete();

        if ($emails === null || $emails === []) {
            return;
        }

        $rows = collect($emails)
            ->map(fn ($email) => strtolower(trim((string) $email)))
            ->filter()
            ->unique()
            ->values()
            ->map(fn (string $email) => ['email' => mb_substr($email, 0, 255)])
            ->all();

        if ($rows !== []) {
            $application->privateAccessEmails()->createMany($rows);
        }
    }

    /**
     * @param  array<int, int|string>|null  $groupIds
     */
    public static function syncMetabaseDashboardAccessGroups(MetabaseDashboard $dashboard, ?array $groupIds): void
    {
        $dashboard->assignedAccessGroups()->detach();

        if ($groupIds === null || $groupIds === []) {
            return;
        }

        $dashboard->assignedAccessGroups()->sync(self::normalizeIds($groupIds));
    }

    /**
     * @param  array<int, int|string>|null  $userIds
     */
    public static function syncMetabaseDashboardUsers(MetabaseDashboard $dashboard, ?array $userIds): void
    {
        $dashboard->assignedUsers()->detach();

        if ($userIds === null || $userIds === []) {
            return;
        }

        $dashboard->assignedUsers()->sync(self::normalizeIds($userIds));
    }

    /**
     * @param  array<int, int|string>|null  $userIds
     */
    public static function syncBroadcastUsers(Broadcast $broadcast, ?array $userIds): void
    {
        $broadcast->assignedUsers()->detach();

        if ($userIds === null || $userIds === []) {
            return;
        }

        $broadcast->assignedUsers()->sync(self::normalizeIds($userIds));
    }

    /**
     * @param  array<int, int|string>|null  $departmentIds
     */
    public static function syncBroadcastDepartments(Broadcast $broadcast, ?array $departmentIds): void
    {
        $broadcast->assignedDepartments()->detach();

        if ($departmentIds === null || $departmentIds === []) {
            return;
        }

        $broadcast->assignedDepartments()->sync(self::normalizeIds($departmentIds));
    }

    /**
     * @param  array<int, string>|null  $emails
     */
    public static function syncCalendarEventAttendees(CalendarEvent $event, ?array $emails): void
    {
        $event->attendees()->delete();

        if ($emails === null || $emails === []) {
            return;
        }

        $rows = collect($emails)
            ->map(fn ($email) => strtolower(trim((string) $email)))
            ->filter()
            ->unique()
            ->values()
            ->map(fn (string $email) => ['email' => mb_substr($email, 0, 255)])
            ->all();

        if ($rows !== []) {
            $event->attendees()->createMany($rows);
        }
    }

    /**
     * @param  array<int, mixed>|null  $slugs
     * @return array<int, string>
     */
    private static function normalizeSlugs(?array $slugs): array
    {
        return array_values(array_filter(
            (array) $slugs,
            fn ($slug) => is_string($slug) && trim($slug) !== ''
        ));
    }

    /**
     * @param  array<int, int|string>  $ids
     * @return array<int, int>
     */
    private static function normalizeIds(array $ids): array
    {
        return array_values(array_unique(array_map('intval', $ids)));
    }
}
