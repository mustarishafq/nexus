<?php

namespace App\Support;

use App\Models\User;

class ProfileCompleteness
{
    /**
     * @var list<array{key: string, label: string}>
     */
    private const CHECKS = [
        ['key' => 'photos', 'label' => 'Profile & cover photo'],
        ['key' => 'name', 'label' => 'Display & full name'],
        ['key' => 'bio', 'label' => 'Bio'],
        ['key' => 'department', 'label' => 'Department'],
        ['key' => 'work_phone', 'label' => 'Work phone'],
        ['key' => 'dates', 'label' => 'Birthday & joined date'],
        ['key' => 'background', 'label' => 'Education or experience'],
        ['key' => 'hr_private', 'label' => 'HR & private details'],
    ];

    /**
     * @return array{percent: int, done_count: int, total_count: int, checks: list<array{key: string, label: string, done: bool}>}
     */
    public static function forUser(User $user): array
    {
        $checks = collect(self::CHECKS)
            ->map(fn (array $item) => [
                'key' => $item['key'],
                'label' => $item['label'],
                'done' => self::isCheckDone($user, $item['key']),
            ])
            ->values()
            ->all();

        $doneCount = collect($checks)->where('done', true)->count();
        $totalCount = count($checks);
        $percent = $totalCount > 0 ? (int) round(($doneCount / $totalCount) * 100) : 0;

        return [
            'percent' => $percent,
            'done_count' => $doneCount,
            'total_count' => $totalCount,
            'checks' => $checks,
        ];
    }

    private static function isCheckDone(User $user, string $key): bool
    {
        return match ($key) {
            'photos' => filled($user->profile_picture) && filled($user->cover_picture),
            'name' => filled(trim((string) $user->name)) && filled(trim((string) $user->full_name)),
            'bio' => filled(trim((string) $user->bio)),
            'department' => filled($user->department_id) || filled(trim((string) ($user->relationLoaded('department') ? $user->department?->name : null))),
            'work_phone' => filled(trim((string) $user->work_phone)),
            'dates' => filled($user->date_of_birth) && filled($user->joined_at),
            'background' => count($user->educationHistoryList()) > 0 || count($user->workHistoryList()) > 0,
            'hr_private' => filled(trim((string) $user->gender))
                && filled(trim((string) $user->nationality))
                && filled(trim((string) $user->ic_number))
                && filled(trim((string) $user->current_address))
                && filled(trim((string) $user->emergency_contact_name))
                && filled(trim((string) $user->emergency_contact_phone))
                && filled(trim((string) $user->next_of_kin_relationship)),
            default => false,
        };
    }
}
