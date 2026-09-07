<?php

namespace App\Support;

class IcNumber
{
    public static function normalize(mixed $value): ?string
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

    public static function dateOfBirth(mixed $value): ?string
    {
        $digits = preg_replace('/\D/', '', (string) ($value ?? ''));
        if ($digits === null || strlen($digits) < 6) {
            return null;
        }

        $yy = (int) substr($digits, 0, 2);
        $mm = (int) substr($digits, 2, 2);
        $dd = (int) substr($digits, 4, 2);
        $currentYy = (int) now()->format('y');
        $year = $yy <= $currentYy ? 2000 + $yy : 1900 + $yy;

        if (! checkdate($mm, $dd, $year)) {
            return null;
        }

        return sprintf('%04d-%02d-%02d', $year, $mm, $dd);
    }

    public static function fillDateOfBirth(?string $current, mixed $ic): ?string
    {
        $current = filled($current) ? substr((string) $current, 0, 10) : null;
        if ($current) {
            return $current;
        }

        return self::dateOfBirth($ic);
    }
}
