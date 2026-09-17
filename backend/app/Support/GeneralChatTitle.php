<?php

namespace App\Support;

use Illuminate\Support\Str;

class GeneralChatTitle
{
    /**
     * @param  list<array<string, mixed>>  $attachments
     */
    public static function fromMessage(string $message, array $attachments = []): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $message) ?? '');
        $lead = '/^(please|pls|hey|hi there|hi|hello|remember(?: that)?|can you|could you|would you|will you|i want you to|i need you to|i want to|i need to|help me(?: to)?)\s+/iu';

        for ($i = 0; $i < 3; $i++) {
            $next = trim((string) preg_replace($lead, '', $text));
            if ($next === $text) {
                break;
            }
            $text = $next;
        }

        if (preg_match('/^(.+?)[.!?]/u', $text, $matches)) {
            $text = trim($matches[1]);
        }

        $text = trim($text, " \t-–—:;,.");

        if ($text === '') {
            $name = GeneralChatAttachments::normalize($attachments)[0]['name'] ?? 'New chat';
            $text = str_replace(['-', '_'], ' ', pathinfo($name, PATHINFO_FILENAME) ?: $name);
        }

        return self::finalize($text);
    }

    public static function fromModel(string $raw, string $fallback, string $assistantReply = ''): string
    {
        $title = trim(preg_replace('/\s+/u', ' ', $raw) ?? '');
        $title = trim($title, " \t\"'`“”‘’");
        $title = preg_replace('/^title:\s*/i', '', $title) ?? $title;

        if (preg_match('/^(.+?)[.!?]/u', $title, $matches) && mb_strlen($matches[1]) >= 3) {
            $title = trim($matches[1]);
        }

        if (! self::isUsable($title, $assistantReply)) {
            return $fallback !== '' ? $fallback : 'New chat';
        }

        return self::finalize($title);
    }

    public static function isUsable(string $title, string $assistantReply = ''): bool
    {
        $title = trim($title);
        if (mb_strlen($title) < 3 || mb_strlen($title) > 80) {
            return false;
        }

        if (str_contains($title, "\n") || str_contains($title, '{')) {
            return false;
        }

        $lower = mb_strtolower($title);
        if (str_contains($lower, 'hello from chat')) {
            return false;
        }

        $reply = trim($assistantReply);
        if ($reply !== '' && mb_strtolower($reply) === $lower) {
            return false;
        }

        return true;
    }

    private static function finalize(string $text): string
    {
        $words = preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $words = array_slice($words, 0, 8);
        $small = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'via', 'with'];
        $titled = [];

        foreach ($words as $index => $word) {
            $lower = mb_strtolower($word);
            if ($index > 0 && in_array($lower, $small, true)) {
                $titled[] = $lower;
            } else {
                $titled[] = mb_convert_case($lower, MB_CASE_TITLE, 'UTF-8');
            }
        }

        $title = trim(implode(' ', $titled));
        $title = Str::limit($title, 72, '…');

        return $title !== '' ? $title : 'New chat';
    }
}
