<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Company;

trait ResolvesCompanyInput
{
    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    protected function resolveCompanyFields(array $validated): array
    {
        if (! array_key_exists('company_id', $validated) && ! array_key_exists('company', $validated)) {
            unset($validated['company']);

            return $validated;
        }

        $validated['company_id'] = $this->resolveCompanyId(
            $validated['company_id'] ?? null,
            $validated['company'] ?? null,
        );
        unset($validated['company']);

        return $validated;
    }

    protected function resolveCompanyId(mixed $companyId, mixed $companyName): ?int
    {
        if ($companyId !== null && $companyId !== '') {
            return (int) $companyId;
        }

        $name = trim((string) ($companyName ?? ''));
        if ($name === '') {
            return null;
        }

        return Company::query()->firstOrCreate(['name' => $name])->id;
    }
}
