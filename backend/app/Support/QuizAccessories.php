<?php

namespace App\Support;

class QuizAccessories
{
    /**
     * Current workplace-appropriate accessory identifiers.
     * Artwork lives on the frontend.
     *
     * @var list<string>
     */
    public const IDS = [
        'crown',
        'graduation_cap',
        'headphones',
        'sunglasses',
        'tie',
        'bow_tie',
        'glasses',
        'sparkle',
        'coffee',
        'cap',
        'lightbulb',
        'badge',
        'pencil',
        'lanyard',
        'visor',
    ];

    /**
     * Retired IDs mapped to a current accessory so saved users/sessions keep working.
     *
     * @var array<string, string>
     */
    public const LEGACY = [
        'party_hat' => 'sparkle',
        'wizard_hat' => 'cap',
        'cowboy_hat' => 'cap',
        'cat_ears' => 'bow_tie',
        'bunny_ears' => 'sparkle',
        'flower_crown' => 'sparkle',
        'chef_hat' => 'cap',
        'detective_hat' => 'glasses',
        'halo' => 'sparkle',
        'devil_horns' => 'sparkle',
        'birthday_hat' => 'sparkle',
    ];

    /**
     * @return list<string>
     */
    public static function acceptedInputIds(): array
    {
        return [...self::IDS, ...array_keys(self::LEGACY), 'none'];
    }

    public static function isValid(?string $id): bool
    {
        return $id !== null && $id !== '' && in_array($id, self::IDS, true);
    }

    public static function normalize(mixed $id): ?string
    {
        if (! is_string($id)) {
            return null;
        }

        $trimmed = trim($id);
        if ($trimmed === '' || strtolower($trimmed) === 'none') {
            return null;
        }

        if (isset(self::LEGACY[$trimmed])) {
            $trimmed = self::LEGACY[$trimmed];
        }

        return self::isValid($trimmed) ? $trimmed : null;
    }
}
