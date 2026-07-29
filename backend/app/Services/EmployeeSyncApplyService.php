<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use App\Support\SyncUserProfileRecords;
use App\Support\UserRoles;

/**
 * Apply inbound Insan employee sync rows onto Brain users.
 */
class EmployeeSyncApplyService
{
    /** @var array<string, int> */
    private array $departmentIdsByName = [];

    /** @var array<string, int> */
    private array $companyIdsByName = [];

    /**
     * Scalar profile/job fields applied from satellite payload.
     *
     * @var list<string>
     */
    private const SCALAR_FIELDS = [
        'employee_id',
        'job_title',
        'employment_type',
        'joined_at',
        'date_of_birth',
        'bio',
        'location',
        'ask_me_about',
        'work_phone',
        'personal_phone',
        'personal_phone_visible',
        'home_phone',
        'gender',
        'place_of_birth',
        'nationality',
        'religion',
        'race',
        'marital_status',
        'current_address',
        'ic_number',
        'epf_number',
        'socso_number',
        'income_tax_number',
        'emergency_contact_name',
        'emergency_contact_phone',
        'next_of_kin_relationship',
        'next_of_kin_ic_number',
        'next_of_kin_nationality',
        'next_of_kin_occupation',
        'next_of_kin_address',
        'spouse_details',
        'children',
    ];

    /**
     * @param  list<array<string, mixed>>  $employees
     * @return array{synced: int, updated: int, skipped: int}
     */
    public function apply(array $employees): array
    {
        $stats = ['synced' => 0, 'updated' => 0, 'skipped' => 0];

        $this->departmentIdsByName = Department::query()->pluck('id', 'name')->all();
        $this->companyIdsByName = Company::query()->pluck('id', 'name')->all();

        /** @var array<int, string|null> */
        $pendingManagers = [];

        foreach ($employees as $row) {
            if (! is_array($row)) {
                $stats['skipped']++;
                continue;
            }

            $email = strtolower(trim((string) ($row['email'] ?? '')));
            $nexusId = isset($row['nexus_user_id']) ? (string) $row['nexus_user_id'] : '';

            $user = null;
            if ($nexusId !== '') {
                $user = User::withTrashed()->find($nexusId);
            }
            if (! $user && $email !== '') {
                $user = User::withTrashed()->where('email', $email)->first();
            }

            if (! $user) {
                $stats['skipped']++;
                continue;
            }

            $fill = [
                'name' => $row['name'] ?? $user->name,
                'full_name' => $row['full_name'] ?? $user->full_name,
            ];

            if (array_key_exists('email', $row) && $email !== '') {
                $fill['email'] = $email;
            }

            if (array_key_exists('role', $row) && in_array($row['role'], UserRoles::ALL, true)) {
                $fill['role'] = $row['role'];
            }

            if (array_key_exists('is_approved', $row)) {
                $fill['is_approved'] = (bool) $row['is_approved'];
            }

            if (array_key_exists('profile_picture', $row)) {
                $fill['profile_picture'] = $row['profile_picture'] ?: null;
            }
            if (array_key_exists('cover_picture', $row)) {
                $fill['cover_picture'] = $row['cover_picture'] ?: null;
            }

            $departmentId = $this->resolveDepartmentId($row['department_name'] ?? null);
            if ($departmentId !== null) {
                $fill['department_id'] = $departmentId;
            }
            $companyId = $this->resolveCompanyId($row['company_name'] ?? null);
            if ($companyId !== null) {
                $fill['company_id'] = $companyId;
            }

            foreach (self::SCALAR_FIELDS as $field) {
                if (! array_key_exists($field, $row)) {
                    continue;
                }
                $value = $row[$field];
                if (in_array($field, ['spouse_details', 'children'], true)) {
                    $fill[$field] = is_array($value) ? $value : null;
                    continue;
                }
                if ($field === 'personal_phone_visible') {
                    $fill[$field] = (bool) $value;
                    continue;
                }
                if (in_array($field, ['employee_id', 'job_title', 'employment_type', 'joined_at'], true)
                    && ($value === null || $value === '')) {
                    continue;
                }
                $fill[$field] = ($value === null || $value === '') ? null : $value;
            }

            $user->forceFill($fill)->save();

            if (array_key_exists('education_history', $row)) {
                SyncUserProfileRecords::syncEducations(
                    $user,
                    is_array($row['education_history']) ? $row['education_history'] : []
                );
            }
            if (array_key_exists('work_history', $row)) {
                SyncUserProfileRecords::syncWorkExperiences(
                    $user,
                    is_array($row['work_history']) ? $row['work_history'] : []
                );
            }
            if (array_key_exists('skills', $row)) {
                SyncUserProfileRecords::syncSkills(
                    $user,
                    is_array($row['skills']) ? $row['skills'] : []
                );
            }

            $deleted = (bool) ($row['deleted'] ?? false);
            if ($deleted && ! $user->trashed()) {
                $user->delete();
            } elseif (! $deleted && $user->trashed()) {
                $user->restore();
            }

            $pendingManagers[$user->id] = isset($row['manager_nexus_user_id']) && $row['manager_nexus_user_id'] !== ''
                ? (string) $row['manager_nexus_user_id']
                : null;

            $stats['updated']++;
            $stats['synced']++;
        }

        foreach ($pendingManagers as $userId => $managerNexusId) {
            $managerId = null;
            if ($managerNexusId) {
                $manager = User::withTrashed()->find($managerNexusId);
                if ($manager && (int) $manager->id !== (int) $userId) {
                    $managerId = $manager->id;
                }
            }
            User::withTrashed()->whereKey($userId)->update(['manager_id' => $managerId]);
        }

        return $stats;
    }

    private function resolveDepartmentId(?string $name): ?int
    {
        $name = trim((string) $name);
        if ($name === '') {
            return null;
        }
        if (isset($this->departmentIdsByName[$name])) {
            return $this->departmentIdsByName[$name];
        }
        $id = Department::query()->firstOrCreate(['name' => $name])->id;
        $this->departmentIdsByName[$name] = $id;

        return $id;
    }

    private function resolveCompanyId(?string $name): ?int
    {
        $name = trim((string) $name);
        if ($name === '') {
            return null;
        }
        if (isset($this->companyIdsByName[$name])) {
            return $this->companyIdsByName[$name];
        }
        $id = Company::query()->firstOrCreate(['name' => $name])->id;
        $this->companyIdsByName[$name] = $id;

        return $id;
    }
}
