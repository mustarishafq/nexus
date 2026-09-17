<?php

namespace App\Services\SatelliteAi;

class AttachmentNormalizer
{
    public const MAX_FILES = 10;

    public const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

    public const MAX_TEXT_CHARS = 200_000;

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $attachments
     * @return list<array<string, mixed>>
     */
    public function merge(array $messages, array $attachments): array
    {
        if ($attachments === []) {
            $this->assertTextBudget($messages);

            return $messages;
        }

        if (count($attachments) > self::MAX_FILES) {
            throw new SatelliteAiException('A request may include at most '.self::MAX_FILES.' attachments.', 422);
        }

        $parts = [];
        $totalBytes = 0;

        foreach ($attachments as $index => $attachment) {
            if (! is_array($attachment)) {
                throw new SatelliteAiException('Each attachment must be an object.', 422);
            }

            $filename = trim((string) ($attachment['filename'] ?? 'attachment-'.($index + 1)));
            $mediaType = strtolower(trim((string) ($attachment['media_type'] ?? $attachment['content_type'] ?? '')));
            $data = (string) ($attachment['data'] ?? '');

            if ($data === '') {
                throw new SatelliteAiException("Attachment {$filename} is missing data.", 422);
            }

            $binary = base64_decode($data, true);
            if ($binary === false) {
                throw new SatelliteAiException("Attachment {$filename} is not valid base64.", 422);
            }

            $totalBytes += strlen($binary);
            if ($totalBytes > self::MAX_TOTAL_BYTES) {
                throw new SatelliteAiException('Attachments exceed the 12MB request limit.', 413);
            }

            if ($mediaType === '') {
                $mediaType = $this->guessMediaType($filename);
            }

            $parts[] = $this->toContentPart($filename, $mediaType, $binary, $data);
        }

        $messages = $this->appendParts($messages, $parts);
        $this->assertTextBudget($messages);

        return $messages;
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $parts
     * @return list<array<string, mixed>>
     */
    private function appendParts(array $messages, array $parts): array
    {
        if ($parts === []) {
            return $messages;
        }

        for ($i = count($messages) - 1; $i >= 0; $i--) {
            if (($messages[$i]['role'] ?? null) === 'user') {
                $messages[$i]['content'] = $this->mergeContent($messages[$i]['content'] ?? '', $parts);

                return $messages;
            }
        }

        $messages[] = [
            'role' => 'user',
            'content' => $parts,
        ];

        return $messages;
    }

    /**
     * @param  list<array<string, mixed>>  $parts
     * @return list<array<string, mixed>>|string
     */
    private function mergeContent(mixed $content, array $parts): array
    {
        $existing = [];
        if (is_string($content) && $content !== '') {
            $existing[] = ['type' => 'text', 'text' => $content];
        } elseif (is_array($content)) {
            $existing = $content;
        }

        return array_values([...$existing, ...$parts]);
    }

    /**
     * @return array<string, mixed>
     */
    private function toContentPart(string $filename, string $mediaType, string $binary, string $base64): array
    {
        if ($this->isTextLike($filename, $mediaType)) {
            $text = mb_convert_encoding($binary, 'UTF-8', 'UTF-8');

            return [
                'type' => 'text',
                'text' => "Attached file {$filename}:\n".$text,
            ];
        }

        if (str_starts_with($mediaType, 'image/') && in_array($mediaType, ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'], true)) {
            $normalized = $mediaType === 'image/jpg' ? 'image/jpeg' : $mediaType;

            return [
                'type' => 'image_url',
                'image_url' => [
                    'url' => "data:{$normalized};base64,{$base64}",
                ],
            ];
        }

        if ($mediaType === 'application/pdf' || str_ends_with(strtolower($filename), '.pdf')) {
            return [
                'type' => 'file',
                'file' => [
                    'filename' => $filename !== '' ? $filename : 'document.pdf',
                    'file_data' => 'data:application/pdf;base64,'.$base64,
                ],
            ];
        }

        throw new SatelliteAiException(
            "Attachment {$filename} ({$mediaType}) cannot be forwarded. Use markdown, text, CSV, JSON, PDF, or an image.",
            422
        );
    }

    private function isTextLike(string $filename, string $mediaType): bool
    {
        $lower = strtolower($filename);
        if (str_ends_with($lower, '.md')
            || str_ends_with($lower, '.txt')
            || str_ends_with($lower, '.csv')
            || str_ends_with($lower, '.json')) {
            return true;
        }

        return in_array($mediaType, [
            'text/plain',
            'text/markdown',
            'text/csv',
            'application/json',
            'application/csv',
        ], true);
    }

    private function guessMediaType(string $filename): string
    {
        $lower = strtolower($filename);

        return match (true) {
            str_ends_with($lower, '.md') => 'text/markdown',
            str_ends_with($lower, '.txt') => 'text/plain',
            str_ends_with($lower, '.csv') => 'text/csv',
            str_ends_with($lower, '.json') => 'application/json',
            str_ends_with($lower, '.pdf') => 'application/pdf',
            str_ends_with($lower, '.png') => 'image/png',
            str_ends_with($lower, '.jpg'), str_ends_with($lower, '.jpeg') => 'image/jpeg',
            str_ends_with($lower, '.webp') => 'image/webp',
            str_ends_with($lower, '.gif') => 'image/gif',
            default => 'application/octet-stream',
        };
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     */
    private function assertTextBudget(array $messages): void
    {
        $chars = 0;
        foreach ($messages as $message) {
            $chars += mb_strlen($this->stringifyContent($message['content'] ?? ''));
        }

        if ($chars > self::MAX_TEXT_CHARS) {
            throw new SatelliteAiException('Prompt text exceeds the maximum length.', 422);
        }
    }

    public function stringifyContent(mixed $content): string
    {
        if (is_string($content)) {
            return $content;
        }

        if (! is_array($content)) {
            return '';
        }

        $chunks = [];
        foreach ($content as $part) {
            if (! is_array($part)) {
                continue;
            }
            if (isset($part['text']) && is_string($part['text'])) {
                $chunks[] = $part['text'];
            } elseif (($part['type'] ?? '') === 'image_url') {
                $chunks[] = '[image]';
            } elseif (($part['type'] ?? '') === 'file') {
                $name = (string) ($part['file']['filename'] ?? 'file');
                $chunks[] = '[file '.$name.']';
            }
        }

        return implode("\n", $chunks);
    }
}
