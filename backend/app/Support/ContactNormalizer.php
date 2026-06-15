<?php

namespace App\Support;

class ContactNormalizer
{
    public static function phone(mixed $value): ?string
    {
        $trimmed = trim((string) ($value ?? ''));
        if ($trimmed === '') {
            return null;
        }

        $digits = preg_replace('/\D/', '', $trimmed) ?? '';
        if ($digits === '') {
            return null;
        }

        if (str_starts_with($digits, '01') || (str_starts_with($digits, '0') && strlen($digits) >= 9)) {
            return '+60'.substr($digits, 1);
        }

        if (str_starts_with($digits, '60')) {
            return '+'.$digits;
        }

        if (preg_match('/^1\d/', $digits) && strlen($digits) >= 9 && strlen($digits) <= 11) {
            return '+60'.$digits;
        }

        return str_starts_with($trimmed, '+') ? '+'.$digits : $digits;
    }

    public static function ic(mixed $value): ?string
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
