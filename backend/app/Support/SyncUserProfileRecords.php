<?php

namespace App\Support;

use App\Models\User;

class SyncUserProfileRecords
{
    /**
     * @param  array<int, array<string, mixed>>|null  $items
     */
    public static function syncEducations(User $user, ?array $items): void
    {
        $user->educations()->delete();

        if ($items === null) {
            return;
        }

        $rows = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                continue;
            }

            $institution = trim((string) ($item['institution'] ?? ''));
            if ($institution === '') {
                continue;
            }

            $rows[] = [
                'institution' => mb_substr($institution, 0, 150),
                'qualification' => self::nullableString($item['qualification'] ?? null, 150),
                'field_of_study' => self::nullableString($item['field_of_study'] ?? null, 150),
                'year_from' => self::nullableString($item['year_from'] ?? null, 10),
                'year_to' => self::nullableString($item['year_to'] ?? null, 10),
                'sort_order' => $index,
            ];
        }

        if ($rows !== []) {
            $user->educations()->createMany($rows);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>|null  $items
     */
    public static function syncWorkExperiences(User $user, ?array $items): void
    {
        $user->workExperiences()->delete();

        if ($items === null) {
            return;
        }

        $rows = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                continue;
            }

            $company = trim((string) ($item['company'] ?? ''));
            if ($company === '') {
                continue;
            }

            $rows[] = [
                'company' => mb_substr($company, 0, 150),
                'job_title' => self::nullableString($item['job_title'] ?? null, 150),
                'date_from' => self::nullableString($item['date_from'] ?? null, 20),
                'date_to' => self::nullableString($item['date_to'] ?? null, 20),
                'description' => self::nullableString($item['description'] ?? null, 500),
                'sort_order' => $index,
            ];
        }

        if ($rows !== []) {
            $user->workExperiences()->createMany($rows);
        }
    }

    /**
     * @param  array<int, string>|null  $items
     */
    public static function syncSkills(User $user, ?array $items): void
    {
        $user->userSkills()->delete();

        if ($items === null) {
            return;
        }

        $rows = [];
        $seen = [];

        foreach (array_values($items) as $index => $item) {
            $name = trim(is_string($item) ? $item : (string) ($item['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $name = mb_substr($name, 0, 50);
            $key = strtolower($name);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $rows[] = [
                'name' => $name,
                'sort_order' => $index,
            ];
        }

        if ($rows !== []) {
            $user->userSkills()->createMany($rows);
        }
    }

    private static function nullableString(mixed $value, int $maxLength): ?string
    {
        $string = trim((string) ($value ?? ''));
        if ($string === '') {
            return null;
        }

        return mb_substr($string, 0, $maxLength);
    }
}
