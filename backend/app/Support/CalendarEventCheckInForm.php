<?php

namespace App\Support;

use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CalendarEventCheckInForm
{
    public const AUDIENCE_PUBLIC = 'public';

    public const AUDIENCE_EVERYONE = 'everyone';

    public const TYPE_TEXT = 'text';

    public const TYPE_PHONE = 'phone';

    public const TYPE_TEXTAREA = 'textarea';

    public const TYPE_POLL = 'poll';

    public const MAX_FIELDS = 10;

    public const MAX_LABEL = 80;

    public const MAX_KEY = 40;

    public const MAX_ANSWER = 500;

    public const MAX_OPTIONS = 20;

    public const MIN_POLL_OPTIONS = 2;

    public const RESERVED_KEYS = ['email'];

    public const FIELD_TYPES = [
        self::TYPE_TEXT,
        self::TYPE_PHONE,
        self::TYPE_TEXTAREA,
        self::TYPE_POLL,
    ];

    /**
     * @return list<array{id: string, key: string, label: string, type: string, required: bool}>
     */
    public static function defaultFields(): array
    {
        return [
            [
                'id' => 'name',
                'key' => 'name',
                'label' => 'Name',
                'type' => self::TYPE_TEXT,
                'required' => false,
            ],
        ];
    }

    public static function defaultAudience(): string
    {
        return self::AUDIENCE_PUBLIC;
    }

    /**
     * @param  mixed  $stored
     * @return list<array{id: string, key: string, label: string, type: string, required: bool}>
     */
    public static function fieldsForEvent(mixed $stored): array
    {
        if ($stored === null) {
            return self::defaultFields();
        }

        if (! is_array($stored)) {
            return self::defaultFields();
        }

        try {
            return self::normalizeFields($stored);
        } catch (ValidationException) {
            return self::defaultFields();
        }
    }

    public static function audienceForEvent(mixed $stored): string
    {
        return self::normalizeAudience($stored);
    }

    public static function normalizeAudience(mixed $audience): string
    {
        $value = strtolower(trim((string) ($audience ?? '')));

        return $value === self::AUDIENCE_EVERYONE
            ? self::AUDIENCE_EVERYONE
            : self::AUDIENCE_PUBLIC;
    }

    public static function requiresAnswersForStaff(string $audience): bool
    {
        return $audience === self::AUDIENCE_EVERYONE;
    }

    /**
     * @param  mixed  $fields
     * @return list<array{id: string, key: string, label: string, type: string, required: bool}>
     */
    public static function normalizeFields(mixed $fields): array
    {
        if (! is_array($fields)) {
            throw ValidationException::withMessages([
                'check_in_form_fields' => ['Check-in form fields must be a list.'],
            ]);
        }

        if (count($fields) > self::MAX_FIELDS) {
            throw ValidationException::withMessages([
                'check_in_form_fields' => ['You can add at most '.self::MAX_FIELDS.' check-in fields.'],
            ]);
        }

        $normalized = [];
        $seenKeys = [];

        foreach (array_values($fields) as $index => $field) {
            if (! is_array($field)) {
                throw ValidationException::withMessages([
                    "check_in_form_fields.{$index}" => ['Each check-in field must be an object.'],
                ]);
            }

            $label = trim((string) ($field['label'] ?? ''));

            if ($label === '') {
                throw ValidationException::withMessages([
                    "check_in_form_fields.{$index}.label" => ['Each check-in field needs a label.'],
                ]);
            }

            if (mb_strlen($label) > self::MAX_LABEL) {
                $label = mb_substr($label, 0, self::MAX_LABEL);
            }

            $type = strtolower(trim((string) ($field['type'] ?? self::TYPE_TEXT)));

            if (! in_array($type, self::FIELD_TYPES, true)) {
                throw ValidationException::withMessages([
                    "check_in_form_fields.{$index}.type" => ['Choose text, phone, long text, or poll.'],
                ]);
            }

            $key = self::sanitizeKey($field['key'] ?? null);

            if ($key === '') {
                $key = self::sanitizeKey($label);
            }

            if ($key === '' || in_array($key, self::RESERVED_KEYS, true)) {
                $key = 'field';
            }

            $uniqueKey = $key;
            $suffix = 2;

            while (isset($seenKeys[$uniqueKey])) {
                $uniqueKey = self::truncateKey($key.'_'.$suffix);
                $suffix++;
            }

            $seenKeys[$uniqueKey] = true;

            $id = trim((string) ($field['id'] ?? ''));

            if ($id === '' || mb_strlen($id) > 64) {
                $id = (string) Str::uuid();
            }

            $item = [
                'id' => $id,
                'key' => $uniqueKey,
                'label' => $label,
                'type' => $type,
                'required' => filter_var($field['required'] ?? false, FILTER_VALIDATE_BOOLEAN),
            ];

            if ($type === self::TYPE_POLL) {
                $item['multiple'] = filter_var($field['multiple'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $item['options'] = self::normalizeOptions($field['options'] ?? null, $index);
            }

            $normalized[] = $item;
        }

        return $normalized;
    }

    /**
     * @param  list<array{id?: string, key: string, label: string, type: string, required: bool}>  $fields
     * @return array<string, string>
     */
    public static function validateAnswers(array $fields, mixed $answers, mixed $legacyName = null): array
    {
        $answers = is_array($answers) ? $answers : [];

        $hasNameField = collect($fields)->contains(
            fn (array $field): bool => ($field['key'] ?? '') === 'name'
        );

        if ($hasNameField && ! array_key_exists('name', $answers)) {
            $legacy = is_string($legacyName) || is_numeric($legacyName)
                ? trim((string) $legacyName)
                : '';

            if ($legacy !== '') {
                $answers['name'] = $legacy;
            }
        }

        $validated = [];

        foreach ($fields as $field) {
            $key = (string) ($field['key'] ?? '');

            if ($key === '') {
                continue;
            }

            $raw = $answers[$key] ?? null;
            $required = (bool) ($field['required'] ?? false);
            $label = (string) ($field['label'] ?? 'This field');
            $type = (string) ($field['type'] ?? self::TYPE_TEXT);

            if ($type === self::TYPE_POLL) {
                $pollValue = self::validatePollAnswer($field, $raw, $key, $label, $required);

                if ($pollValue === null) {
                    continue;
                }

                $validated[$key] = $pollValue;
                continue;
            }

            $value = is_string($raw) || is_numeric($raw) ? trim((string) $raw) : '';

            if ($required && $value === '') {
                throw ValidationException::withMessages([
                    "answers.{$key}" => ["{$label} is required."],
                ]);
            }

            if ($value === '') {
                continue;
            }

            if (mb_strlen($value) > self::MAX_ANSWER) {
                throw ValidationException::withMessages([
                    "answers.{$key}" => ["{$label} must be at most ".self::MAX_ANSWER.' characters.'],
                ]);
            }

            if ($type === self::TYPE_PHONE) {
                $normalizedPhone = ContactNormalizer::phone($value);

                if ($normalizedPhone === null) {
                    throw ValidationException::withMessages([
                        "answers.{$key}" => ["Enter a valid phone number for {$label}."],
                    ]);
                }

                $value = $normalizedPhone;
            }

            $validated[$key] = $value;
        }

        return $validated;
    }

    public static function formatAnswer(mixed $value): string
    {
        if (is_array($value)) {
            return collect($value)
                ->map(fn ($item) => trim((string) $item))
                ->filter()
                ->implode(', ');
        }

        return trim((string) ($value ?? ''));
    }

    /**
     * @param  array<string, mixed>  $answers
     */
    public static function displayNameFromAnswers(array $answers, ?string $fallback = null): ?string
    {
        $name = trim((string) ($answers['name'] ?? ''));

        if ($name !== '') {
            return $name;
        }

        $fallback = $fallback !== null ? trim($fallback) : '';

        return $fallback !== '' ? $fallback : null;
    }

    /**
     * @param  list<array{key: string, label: string}>  $fields
     * @return list<array{key: string, label: string}>
     */
    public static function extraColumns(array $fields): array
    {
        return array_values(array_filter(
            $fields,
            fn (array $field): bool => ($field['key'] ?? '') !== 'name'
        ));
    }

    /**
     * Public payload for the QR check-in page.
     *
     * @return array{audience: string, fields: list<array{id: string, key: string, label: string, type: string, required: bool}>}
     */
    public static function present(?array $fields, mixed $audience): array
    {
        return [
            'audience' => self::audienceForEvent($audience),
            'fields' => self::fieldsForEvent($fields),
        ];
    }

    /**
     * @param  mixed  $options
     * @return list<array{id: string, label: string}>
     */
    protected static function normalizeOptions(mixed $options, int $fieldIndex): array
    {
        if (! is_array($options)) {
            throw ValidationException::withMessages([
                "check_in_form_fields.{$fieldIndex}.options" => ['Poll fields need a list of options.'],
            ]);
        }

        $normalized = [];
        $seenIds = [];
        $seenLabels = [];

        foreach (array_values($options) as $option) {
            if (is_string($option) || is_numeric($option)) {
                $option = ['label' => (string) $option];
            }

            if (! is_array($option)) {
                continue;
            }

            $label = trim((string) ($option['label'] ?? ''));

            if ($label === '') {
                continue;
            }

            if (mb_strlen($label) > self::MAX_LABEL) {
                $label = mb_substr($label, 0, self::MAX_LABEL);
            }

            $labelKey = strtolower($label);

            if (isset($seenLabels[$labelKey])) {
                continue;
            }

            $seenLabels[$labelKey] = true;

            $id = trim((string) ($option['id'] ?? ''));

            if ($id === '' || mb_strlen($id) > 64 || isset($seenIds[$id])) {
                $id = (string) Str::uuid();
            }

            $seenIds[$id] = true;

            $normalized[] = [
                'id' => $id,
                'label' => $label,
            ];

            if (count($normalized) >= self::MAX_OPTIONS) {
                break;
            }
        }

        if (count($normalized) < self::MIN_POLL_OPTIONS) {
            throw ValidationException::withMessages([
                "check_in_form_fields.{$fieldIndex}.options" => ['Poll fields need at least two options.'],
            ]);
        }

        return $normalized;
    }

    /**
     * @param  array{options?: list<array{id: string, label: string}>, multiple?: bool}  $field
     */
    protected static function validatePollAnswer(
        array $field,
        mixed $raw,
        string $key,
        string $label,
        bool $required,
    ): string|array|null {
        $options = is_array($field['options'] ?? null) ? $field['options'] : [];
        $byId = [];
        $byLabel = [];

        foreach ($options as $option) {
            if (! is_array($option)) {
                continue;
            }

            $optionId = trim((string) ($option['id'] ?? ''));
            $optionLabel = trim((string) ($option['label'] ?? ''));

            if ($optionLabel === '') {
                continue;
            }

            $byLabel[strtolower($optionLabel)] = $optionLabel;

            if ($optionId !== '') {
                $byId[$optionId] = $optionLabel;
            }
        }

        $resolve = function (mixed $value) use ($byId, $byLabel): ?string {
            $candidate = is_string($value) || is_numeric($value) ? trim((string) $value) : '';

            if ($candidate === '') {
                return null;
            }

            if (isset($byId[$candidate])) {
                return $byId[$candidate];
            }

            return $byLabel[strtolower($candidate)] ?? null;
        };

        $multiple = (bool) ($field['multiple'] ?? false);

        if ($multiple) {
            $selected = [];

            if (is_array($raw)) {
                foreach ($raw as $item) {
                    $matched = $resolve($item);
                    if ($matched !== null) {
                        $selected[$matched] = $matched;
                    } elseif (is_string($item) || is_numeric($item)) {
                        if (trim((string) $item) !== '') {
                            throw ValidationException::withMessages([
                                "answers.{$key}" => ["Choose a valid option for {$label}."],
                            ]);
                        }
                    }
                }
            } elseif (is_string($raw) || is_numeric($raw)) {
                $matched = $resolve($raw);
                if ($matched !== null) {
                    $selected[$matched] = $matched;
                } elseif (trim((string) $raw) !== '') {
                    throw ValidationException::withMessages([
                        "answers.{$key}" => ["Choose a valid option for {$label}."],
                    ]);
                }
            }

            $values = array_values($selected);

            if ($required && $values === []) {
                throw ValidationException::withMessages([
                    "answers.{$key}" => ["{$label} is required."],
                ]);
            }

            return $values === [] ? null : $values;
        }

        $candidate = is_array($raw) ? ($raw[0] ?? '') : $raw;
        $matched = $resolve($candidate);

        if ($matched === null && (is_string($candidate) || is_numeric($candidate)) && trim((string) $candidate) !== '') {
            throw ValidationException::withMessages([
                "answers.{$key}" => ["Choose a valid option for {$label}."],
            ]);
        }

        if ($required && $matched === null) {
            throw ValidationException::withMessages([
                "answers.{$key}" => ["{$label} is required."],
            ]);
        }

        return $matched;
    }

    protected static function sanitizeKey(mixed $value): string
    {
        $key = strtolower(trim((string) ($value ?? '')));
        $key = preg_replace('/[^a-z0-9]+/', '_', $key) ?? '';
        $key = trim($key, '_');

        return self::truncateKey($key);
    }

    protected static function truncateKey(string $key): string
    {
        if (strlen($key) <= self::MAX_KEY) {
            return $key;
        }

        return substr($key, 0, self::MAX_KEY);
    }
}
