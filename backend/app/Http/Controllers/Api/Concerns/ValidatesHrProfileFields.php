<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Support\HealthStatus;
use App\Support\IcNumber;
use Illuminate\Validation\Rule;

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
            'spouse_details.date_of_birth' => ['sometimes', 'nullable', 'date'],
            'children' => ['sometimes', 'nullable', 'array', 'max:10'],
            'children.*.name' => ['required_with:children', 'string', 'max:150'],
            'children.*.ic_number' => ['sometimes', 'nullable', 'string', 'max:20'],
            'children.*.school' => ['sometimes', 'nullable', 'string', 'max:150'],
            'children.*.date_of_birth' => ['sometimes', 'nullable', 'date'],
            'health_status' => [
                'sometimes',
                'nullable',
                'array',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $error = HealthStatus::validationError($value);
                    if ($error !== null) {
                        $fail($error);
                    }
                },
            ],
            'health_status.conditions' => ['sometimes', 'nullable', 'array'],
            'health_status.conditions.*' => ['string', Rule::in(HealthStatus::keys())],
            'health_status.others' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    protected function normalizeHrProfilePayload(array $validated, ?string $existingDateOfBirth = null): array
    {
        if (array_key_exists('ic_number', $validated)) {
            $validated['ic_number'] = IcNumber::normalize($validated['ic_number']);
            $fromIc = IcNumber::dateOfBirth($validated['ic_number']);
            if ($fromIc) {
                $currentDob = array_key_exists('date_of_birth', $validated)
                    ? (filled($validated['date_of_birth']) ? substr((string) $validated['date_of_birth'], 0, 10) : null)
                    : (filled($existingDateOfBirth) ? substr($existingDateOfBirth, 0, 10) : null);

                if (! $currentDob) {
                    $validated['date_of_birth'] = $fromIc;
                }
            }
        }

        if (array_key_exists('next_of_kin_ic_number', $validated)) {
            $validated['next_of_kin_ic_number'] = IcNumber::normalize($validated['next_of_kin_ic_number']);
        }

        if (array_key_exists('spouse_details', $validated)) {
            $validated['spouse_details'] = $this->normalizeSpouseDetails($validated['spouse_details']);
        }

        if (array_key_exists('children', $validated)) {
            $validated['children'] = $this->normalizeChildren($validated['children']);
        }

        if (array_key_exists('health_status', $validated)) {
            $validated['health_status'] = HealthStatus::normalize($validated['health_status']);
        }

        return $validated;
    }

    /**
     * @return array<string, string|null>|null
     */
    private function normalizeSpouseDetails(mixed $value): ?array
    {
        if (! is_array($value)) {
            return null;
        }

        $icNumber = IcNumber::normalize($value['ic_number'] ?? null);
        $dateOfBirth = trim((string) ($value['date_of_birth'] ?? ''));
        $dateOfBirth = $dateOfBirth !== '' ? substr($dateOfBirth, 0, 10) : null;
        $dateOfBirth = IcNumber::fillDateOfBirth($dateOfBirth, $icNumber);

        $details = [
            'full_name' => trim((string) ($value['full_name'] ?? '')),
            'ic_number' => $icNumber ?? '',
            'phone' => trim((string) ($value['phone'] ?? '')),
            'occupation' => trim((string) ($value['occupation'] ?? '')),
            'employer_name' => trim((string) ($value['employer_name'] ?? '')),
            'employer_address' => trim((string) ($value['employer_address'] ?? '')),
            'date_of_birth' => $dateOfBirth ?? '',
        ];

        $hasContent = collect($details)->contains(fn (string $item) => $item !== '');

        if (! $hasContent) {
            return null;
        }

        $details['ic_number'] = $icNumber;
        $details['date_of_birth'] = $dateOfBirth;

        return $details;
    }

    /**
     * @return array<int, array<string, string|null>>|null
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
                $icNumber = IcNumber::normalize($item['ic_number'] ?? null);
                $school = trim((string) ($item['school'] ?? ''));
                $dateOfBirth = trim((string) ($item['date_of_birth'] ?? ''));
                $dateOfBirth = $dateOfBirth !== '' ? substr($dateOfBirth, 0, 10) : null;
                $dateOfBirth = IcNumber::fillDateOfBirth($dateOfBirth, $icNumber);

                return [
                    'name' => $name,
                    'ic_number' => $icNumber,
                    'school' => $school !== '' ? $school : null,
                    'date_of_birth' => $dateOfBirth,
                ];
            })
            ->filter(function (array $item) {
                return $item['name'] !== ''
                    || filled($item['ic_number'])
                    || filled($item['school'])
                    || filled($item['date_of_birth']);
            })
            ->filter(fn (array $item) => $item['name'] !== '')
            ->values()
            ->take(10)
            ->all();

        return $children === [] ? null : $children;
    }
}
