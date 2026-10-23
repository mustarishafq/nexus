<?php

namespace App\Support;

use App\Models\User;
use App\Support\HealthStatus;

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
     * @return array{percent: int, done_count: int, total_count: int, checks: list<array{key: string, label: string, done: bool, missing: list<string>}>}
     */
    public static function forUser(User $user): array
    {
        // educationHistoryList / workHistoryList return [] unless relations are loaded
        $user->loadMissing(['educations', 'workExperiences']);

        $checks = collect(self::CHECKS)
            ->map(function (array $item) use ($user) {
                $missing = self::missingFields($user, $item['key']);

                return [
                    'key' => $item['key'],
                    'label' => $item['label'],
                    'done' => $missing === [],
                    'missing' => $missing,
                ];
            })
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

    /**
     * Hide private field names from profiles colleagues can see.
     * The section still shows as incomplete; only the specific HR fields are removed.
     *
     * @param  array{percent: int, done_count: int, total_count: int, checks: list<array{key: string, label: string, done: bool, missing: list<string>}>}  $completeness
     * @return array{percent: int, done_count: int, total_count: int, checks: list<array{key: string, label: string, done: bool, missing: list<string>}>}
     */
    public static function redactForPublic(array $completeness): array
    {
        $completeness['checks'] = array_map(function (array $check) {
            if ($check['key'] === 'hr_private') {
                $check['missing'] = [];
            }

            return $check;
        }, $completeness['checks']);

        return $completeness;
    }

    /**
     * @param  array{checks: list<array{label: string, done: bool, missing?: list<string>}>}  $completeness
     * @return list<string>
     */
    public static function missingLabels(array $completeness): array
    {
        return collect($completeness['checks'])
            ->reject(fn (array $check) => $check['done'])
            ->flatMap(function (array $check) {
                $missing = $check['missing'] ?? [];

                return $missing !== [] ? $missing : [$check['label']];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    private static function missingFields(User $user, string $key): array
    {
        return match ($key) {
            'photos' => array_values(array_filter([
                filled($user->profile_picture) ? null : 'Profile photo',
                filled($user->cover_picture) ? null : 'Cover photo',
            ])),
            'name' => array_values(array_filter([
                filled(trim((string) $user->name)) ? null : 'Display name',
                filled(trim((string) $user->full_name)) ? null : 'Full name',
            ])),
            'bio' => filled(trim((string) $user->bio)) ? [] : ['Bio'],
            'department' => (filled($user->department_id) || filled(trim((string) ($user->relationLoaded('department') ? $user->department?->name : null))))
                ? []
                : ['Department'],
            'work_phone' => filled(trim((string) $user->work_phone)) ? [] : ['Work phone'],
            'dates' => array_values(array_filter([
                filled($user->date_of_birth) ? null : 'Birthday',
                filled($user->joined_at) ? null : 'Joined date',
            ])),
            'background' => (count($user->educationHistoryList()) > 0 || count($user->workHistoryList()) > 0)
                ? []
                : ['Education or work experience'],
            'hr_private' => array_values(array_filter([
                filled(trim((string) $user->gender)) ? null : 'Gender',
                filled(trim((string) $user->nationality)) ? null : 'Nationality',
                filled(trim((string) $user->ic_number)) ? null : 'IC number',
                filled(trim((string) $user->current_address)) ? null : 'Current address',
                filled(trim((string) $user->emergency_contact_name)) ? null : 'Emergency contact name',
                filled(trim((string) $user->emergency_contact_phone)) ? null : 'Emergency contact phone',
                filled(trim((string) $user->next_of_kin_relationship)) ? null : 'Next of kin relationship',
                HealthStatus::isComplete($user->health_status) ? null : 'Health status',
                ...self::childrenMissing($user->children),
            ])),
            default => [],
        };
    }

    /**
     * A blank children list is complete. Any child that is started must have every field.
     *
     * @return list<string>
     */
    private static function childrenMissing(mixed $children): array
    {
        if (! is_array($children)) {
            return [];
        }

        $missing = [];

        foreach (array_values($children) as $index => $child) {
            if (! is_array($child)) {
                continue;
            }

            $name = trim((string) ($child['name'] ?? ''));
            $icNumber = trim((string) ($child['ic_number'] ?? ''));
            $school = trim((string) ($child['school'] ?? ''));
            $dateOfBirth = IcNumber::fillDateOfBirth(
                trim((string) ($child['date_of_birth'] ?? '')) ?: null,
                $icNumber
            ) ?? '';
            $fields = [
                'name' => $name,
                'IC no.' => $icNumber,
                'school' => $school,
                'date of birth' => $dateOfBirth,
            ];
            $gaps = [];
            $started = false;

            foreach ($fields as $label => $value) {
                if (filled($value)) {
                    $started = true;
                } else {
                    $gaps[] = $label;
                }
            }

            if (! $started || $gaps === []) {
                continue;
            }

            $number = $index + 1;
            foreach ($gaps as $label) {
                $missing[] = "Child {$number} {$label}";
            }
        }

        return $missing;
    }
}
