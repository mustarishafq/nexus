<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Department;

trait ResolvesDepartmentInput
{
    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    protected function resolveDepartmentFields(array $validated): array
    {
        if (! array_key_exists('department_id', $validated) && ! array_key_exists('department', $validated)) {
            unset($validated['department']);

            return $validated;
        }

        $validated['department_id'] = $this->resolveDepartmentId(
            $validated['department_id'] ?? null,
            $validated['department'] ?? null,
        );
        unset($validated['department']);

        return $validated;
    }

    protected function resolveDepartmentId(mixed $departmentId, mixed $departmentName): ?int
    {
        if ($departmentId !== null && $departmentId !== '') {
            return (int) $departmentId;
        }

        $name = trim((string) ($departmentName ?? ''));
        if ($name === '') {
            return null;
        }

        return Department::query()->firstOrCreate(['name' => $name])->id;
    }
}
