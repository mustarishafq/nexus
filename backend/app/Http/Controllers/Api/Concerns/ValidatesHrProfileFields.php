<?php

namespace App\Http\Controllers\Api\Concerns;

trait ValidatesHrProfileFields
{
    /**
     * @return array<string, mixed>
     */
    protected function hrProfileValidationRules(): array
    {
        return [
            'place_of_birth' => ['sometimes', 'nullable', 'string', 'max:100'],
            'nationality' => ['sometimes', 'nullable', 'string', 'max:50'],
            'religion' => ['sometimes', 'nullable', 'string', 'max:50'],
            'race' => ['sometimes', 'nullable', 'string', 'max:50'],
            'marital_status' => ['sometimes', 'nullable', 'string', 'max:30'],
            'current_address' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'home_phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'ic_number' => ['sometimes', 'nullable', 'string', 'max:20'],
            'epf_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'socso_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'income_tax_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'next_of_kin_relationship' => ['sometimes', 'nullable', 'string', 'max:50'],
            'next_of_kin_ic_number' => ['sometimes', 'nullable', 'string', 'max:20'],
            'next_of_kin_nationality' => ['sometimes', 'nullable', 'string', 'max:50'],
            'next_of_kin_occupation' => ['sometimes', 'nullable', 'string', 'max:150'],
            'next_of_kin_address' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'spouse_details' => ['sometimes', 'nullable', 'array'],
            'spouse_details.full_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'spouse_details.ic_number' => ['sometimes', 'nullable', 'string', 'max:20'],
            'spouse_details.phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'spouse_details.occupation' => ['sometimes', 'nullable', 'string', 'max:150'],
            'spouse_details.employer_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'spouse_details.employer_address' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'children' => ['sometimes', 'nullable', 'array', 'max:10'],
            'children.*.name' => ['required_with:children', 'string', 'max:150'],
            'children.*.age' => ['sometimes', 'nullable', 'string', 'max:10'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    protected function normalizeHrProfilePayload(array $validated): array
    {
        if (array_key_exists('spouse_details', $validated)) {
            $validated['spouse_details'] = $this->normalizeSpouseDetails($validated['spouse_details']);
        }

        if (array_key_exists('ic_number', $validated)) {
            $validated['ic_number'] = $this->normalizeIcNumber($validated['ic_number']);
        }

        if (array_key_exists('next_of_kin_ic_number', $validated)) {
            $validated['next_of_kin_ic_number'] = $this->normalizeIcNumber($validated['next_of_kin_ic_number']);
        }

        if (array_key_exists('children', $validated)) {
            $validated['children'] = $this->normalizeChildren($validated['children']);
        }

        return $validated;
    }

    /**
     * @return array<string, string>|null
     */
    private function normalizeSpouseDetails(mixed $value): ?array
    {
        if (! is_array($value)) {
            return null;
        }

        $details = [
            'full_name' => trim((string) ($value['full_name'] ?? '')),
            'ic_number' => $this->normalizeIcNumber($value['ic_number'] ?? null),
            'phone' => trim((string) ($value['phone'] ?? '')),
            'occupation' => trim((string) ($value['occupation'] ?? '')),
            'employer_name' => trim((string) ($value['employer_name'] ?? '')),
            'employer_address' => trim((string) ($value['employer_address'] ?? '')),
        ];

        $hasContent = collect($details)->contains(fn (string $item) => $item !== '');

        return $hasContent ? $details : null;
    }

    /**
     * @return array<int, array<string, string>>|null
     */
    private function normalizeChildren(mixed $value): ?array
    {
        if (! is_array($value)) {
            return null;
        }

        $children = collect($value)
            ->filter(fn ($item) => is_array($item))
            ->map(function (array $item) {
                $name = trim((string) ($item['name'] ?? ''));

                return [
                    'name' => $name,
                    'age' => trim((string) ($item['age'] ?? '')),
                ];
            })
            ->filter(fn (array $item) => $item['name'] !== '')
            ->values()
            ->take(10)
            ->all();

        return $children === [] ? null : $children;
    }

    private function normalizeIcNumber(mixed $value): ?string
    {
        $digits = preg_replace('/\D/', '', (string) ($value ?? ''));
        if ($digits === null || $digits === '') {
            return null;
        }

        $digits = substr($digits, 0, 12);
        if (strlen($digits) <= 6) {
            return $digits;
        }
        if (strlen($digits) <= 8) {
            return substr($digits, 0, 6).'-'.substr($digits, 6);
        }

        return substr($digits, 0, 6).'-'.substr($digits, 6, 2).'-'.substr($digits, 8);
    }
}
