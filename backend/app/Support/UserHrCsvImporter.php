<?php

namespace App\Support;

use App\Http\Controllers\Api\Concerns\ResolvesDepartmentInput;
use App\Models\AccessGroup;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use App\Support\SyncUserProfileRecords;

class UserHrCsvImporter
{
    use ResolvesDepartmentInput;

    /**
     * @return array{created: array<int, string>, updated: array<int, string>, errors: array<int, string>, count: int, total_rows: int}
     */
    public function import(string $filePath): array
    {
        $handle = fopen($filePath, 'r');
        if ($handle === false) {
            return $this->result([], [], ['Failed to open file'], 0);
        }

        $headers = $this->normalizeHeaders(fgetcsv($handle) ?: []);
        if ($headers === []) {
            fclose($handle);

            return $this->result([], [], ['Empty CSV file or invalid format'], 0);
        }

        if (! in_array('email', $headers, true)) {
            fclose($handle);

            return $this->result([], [], ['CSV must include an email column'], 0);
        }

        $created = [];
        $updated = [];
        $errors = [];
        $managerAssignments = [];
        $row = 1;

        while (($data = fgetcsv($handle)) !== false) {
            $row++;

            if ($this->isEmptyRow($data)) {
                continue;
            }

            $record = $this->combineRow($headers, $data);
            if ($record === null) {
                $errors[] = "Row {$row}: CSV column count mismatch";

                continue;
            }

            $email = strtolower(trim((string) ($record['email'] ?? '')));
            if ($email === '') {
                $errors[] = "Row {$row}: missing email";

                continue;
            }

            if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Row {$row}: invalid email '{$email}'";

                continue;
            }

            try {
                $mapped = $this->mapAttributes($record);
                $attributes = $mapped['attributes'];
                $skills = $mapped['skills'];
                $accessGroupsValue = $this->valueFromRecord($record, 'access_groups');
                $managerEmail = $this->valueFromRecord($record, 'manager_email');

                $existing = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();

                if ($existing) {
                    if ($attributes !== []) {
                        $existing->fill($attributes)->save();
                    }

                    if ($skills !== null) {
                        SyncUserProfileRecords::syncSkills($existing, $skills);
                    }

                    if ($accessGroupsValue !== null) {
                        $groupError = $this->syncAccessGroups($existing, $accessGroupsValue, $row);
                        if ($groupError !== null) {
                            $errors[] = $groupError;

                            continue;
                        }
                    }

                    if ($managerEmail !== null) {
                        $managerAssignments[] = ['user_id' => $existing->id, 'manager_email' => strtolower($managerEmail), 'row' => $row];
                    }

                    $updated[] = $email;
                } else {
                    $fullName = $this->valueFromRecord($record, 'full_name');
                    if ($fullName === null) {
                        $errors[] = "Row {$row}: missing full_name for new user '{$email}'";

                        continue;
                    }

                    $password = $this->valueFromRecord($record, 'password') ?? 'Password@123';

                    $user = User::create(array_merge([
                        'name' => $this->valueFromRecord($record, 'name') ?? '',
                        'full_name' => $fullName,
                        'email' => $email,
                        'password' => Hash::make($password),
                        'role' => $this->valueFromRecord($record, 'role') ?? 'user',
                        'is_approved' => $this->booleanFromRecord($record, 'is_approved', true),
                        'force_password_change' => true,
                    ], $attributes));

                    if ($skills !== null) {
                        SyncUserProfileRecords::syncSkills($user, $skills);
                    }

                    if ($accessGroupsValue !== null) {
                        $groupError = $this->syncAccessGroups($user, $accessGroupsValue, $row);
                        if ($groupError !== null) {
                            $errors[] = $groupError;

                            continue;
                        }
                    }

                    if ($managerEmail !== null) {
                        $managerAssignments[] = ['user_id' => $user->id, 'manager_email' => strtolower($managerEmail), 'row' => $row];
                    }

                    $created[] = $email;
                }
            } catch (\Throwable $e) {
                $errors[] = "Row {$row}: ".$e->getMessage();
            }
        }

        fclose($handle);

        foreach ($managerAssignments as $assignment) {
            $manager = User::query()
                ->whereRaw('LOWER(email) = ?', [$assignment['manager_email']])
                ->first();

            if (! $manager) {
                $errors[] = "Row {$assignment['row']}: manager email '{$assignment['manager_email']}' not found";

                continue;
            }

            if ($manager->id === $assignment['user_id']) {
                $errors[] = "Row {$assignment['row']}: user cannot report to themselves";

                continue;
            }

            User::query()->whereKey($assignment['user_id'])->update(['manager_id' => $manager->id]);
        }

        return $this->result($created, $updated, $errors, $row - 1);
    }

    /**
     * @param  array<int, string|null>  $headers
     * @return array<int, string>
     */
    private function normalizeHeaders(array $headers): array
    {
        return array_values(array_filter(array_map(
            fn ($header) => strtolower(trim((string) $header)),
            $headers
        )));
    }

    /**
     * @param  array<int, string|null>  $data
     */
    private function isEmptyRow(array $data): bool
    {
        return collect($data)->every(fn ($value) => trim((string) $value) === '');
    }

    /**
     * @param  array<int, string>  $headers
     * @param  array<int, string|null>  $data
     * @return array<string, string>|null
     */
    private function combineRow(array $headers, array $data): ?array
    {
        if (count($headers) !== count($data)) {
            return null;
        }

        $record = [];
        foreach ($headers as $index => $header) {
            $record[$header] = trim((string) ($data[$index] ?? ''));
        }

        return $record;
    }

    /**
     * @param  array<string, string>  $record
     * @return array{attributes: array<string, mixed>, skills: array<int, string>|null}
     */
    private function mapAttributes(array $record): array
    {
        $attributes = [];

        $stringFields = [
            'name', 'full_name', 'bio', 'job_title', 'employee_id', 'employment_type',
            'place_of_birth', 'nationality', 'religion', 'race', 'marital_status', 'gender',
            'current_address', 'epf_number', 'socso_number', 'income_tax_number', 'location', 'ask_me_about',
            'emergency_contact_name', 'next_of_kin_relationship', 'next_of_kin_nationality',
            'next_of_kin_occupation', 'next_of_kin_address',
        ];

        foreach ($stringFields as $field) {
            $value = $this->valueFromRecord($record, $field);
            if ($value !== null) {
                $attributes[$field] = $value;
            }
        }

        foreach (['work_phone', 'personal_phone', 'home_phone', 'emergency_contact_phone'] as $field) {
            $value = $this->valueFromRecord($record, $field);
            if ($value !== null) {
                $attributes[$field] = ContactNormalizer::phone($value);
            }
        }

        foreach (['ic_number', 'next_of_kin_ic_number'] as $field) {
            $value = $this->valueFromRecord($record, $field);
            if ($value !== null) {
                $attributes[$field] = ContactNormalizer::ic($value);
            }
        }

        if (array_key_exists('personal_phone_visible', $record) && trim($record['personal_phone_visible']) !== '') {
            $attributes['personal_phone_visible'] = $this->booleanFromRecord($record, 'personal_phone_visible', false);
        }

        foreach (['date_of_birth', 'joined_at'] as $field) {
            $value = $this->valueFromRecord($record, $field);
            if ($value !== null) {
                $parsed = $this->parseDate($value);
                if ($parsed !== null) {
                    $attributes[$field] = $parsed;
                }
            }
        }

        $department = $this->valueFromRecord($record, 'department');
        if ($department !== null) {
            $attributes['department_id'] = $this->resolveDepartmentId(null, $department);
        }

        $skills = null;
        $skillsValue = $this->valueFromRecord($record, 'skills');
        if ($skillsValue !== null) {
            $skills = collect(explode(',', $skillsValue))
                ->map(fn (string $skill) => trim($skill))
                ->filter()
                ->take(10)
                ->values()
                ->all();
        }

        $spouse = $this->mapSpouseDetails($record);
        if ($spouse !== null) {
            $attributes['spouse_details'] = $spouse;
        }

        return ['attributes' => $attributes, 'skills' => $skills];
    }

    /**
     * @param  array<string, string>  $record
     * @return array<string, string|null>|null
     */
    private function mapSpouseDetails(array $record): ?array
    {
        $details = [
            'full_name' => $this->valueFromRecord($record, 'spouse_full_name'),
            'ic_number' => ContactNormalizer::ic($this->valueFromRecord($record, 'spouse_ic_number') ?? ''),
            'phone' => ContactNormalizer::phone($this->valueFromRecord($record, 'spouse_phone') ?? ''),
            'occupation' => $this->valueFromRecord($record, 'spouse_occupation'),
            'employer_name' => $this->valueFromRecord($record, 'spouse_employer_name'),
            'employer_address' => $this->valueFromRecord($record, 'spouse_employer_address'),
        ];

        $hasContent = collect($details)->filter(fn ($value) => filled($value))->isNotEmpty();

        return $hasContent ? $details : null;
    }

    /**
     * @param  array<string, string>  $record
     */
    private function valueFromRecord(array $record, string $key): ?string
    {
        if (! array_key_exists($key, $record)) {
            return null;
        }

        $value = trim($record[$key]);

        return $value === '' ? null : $value;
    }

    /**
     * @param  array<string, string>  $record
     */
    private function booleanFromRecord(array $record, string $key, bool $default): bool
    {
        $value = $this->valueFromRecord($record, $key);
        if ($value === null) {
            return $default;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    private function parseDate(string $value): ?string
    {
        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return null;
        }

        return date('Y-m-d', $timestamp);
    }

    private function syncAccessGroups(User $user, string $value, int $row): ?string
    {
        $names = collect(explode(',', $value))
            ->map(fn (string $name) => trim($name))
            ->filter()
            ->values();

        if ($names->isEmpty()) {
            return null;
        }

        $groupIds = [];
        foreach ($names as $name) {
            $group = AccessGroup::query()
                ->whereRaw('LOWER(name) = ?', [strtolower($name)])
                ->first();

            if (! $group) {
                return "Row {$row}: access group '{$name}' not found";
            }

            $groupIds[] = $group->id;
        }

        $user->accessGroups()->sync($groupIds);

        return null;
    }

    /**
     * @param  array<int, string>  $created
     * @param  array<int, string>  $updated
     * @param  array<int, string>  $errors
     * @return array{created: array<int, string>, updated: array<int, string>, errors: array<int, string>, count: int, total_rows: int}
     */
    private function result(array $created, array $updated, array $errors, int $totalRows): array
    {
        return [
            'created' => $created,
            'updated' => $updated,
            'errors' => $errors,
            'count' => count($created) + count($updated),
            'total_rows' => $totalRows,
        ];
    }
}
