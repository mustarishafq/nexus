<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class GeneralChatAttachments
{
    public const MAX_COUNT = 5;

    public const MAX_TEXT_CHARS = 12000;

    public const MAX_IMAGE_BYTES = 8_000_000;

    public const LLM_IMAGE_MAX_BYTES = 1_500_000;

    public const LLM_IMAGE_MAX_EDGE = 1600;

    /**
     * @param  list<mixed>  $items
     * @return list<array{url: string, name: string, mime: string, size: int, kind: string}>
     */
    public static function normalize(array $items): array
    {
        $normalized = [];

        foreach (array_slice($items, 0, self::MAX_COUNT) as $item) {
            if (! is_array($item)) {
                continue;
            }

            $url = PublicStorageUrl::canonicalize($item['url'] ?? $item['file_url'] ?? '') ?? '';
            $url = trim($url);
            if ($url === '') {
                continue;
            }

            $mime = strtolower(trim((string) ($item['mime'] ?? $item['mime_type'] ?? '')));
            $name = trim((string) ($item['name'] ?? $item['filename'] ?? 'attachment'));
            $kind = str_starts_with($mime, 'image/') || self::looksLikeImage($url, $name)
                ? 'image'
                : 'file';

            $normalized[] = [
                'url' => $url,
                'name' => $name !== '' ? mb_substr($name, 0, 180) : 'attachment',
                'mime' => mb_substr($mime, 0, 120),
                'size' => max(0, (int) ($item['size'] ?? 0)),
                'kind' => $kind,
            ];
        }

        return $normalized;
    }

    /**
     * @param  list<array{url?: string, name?: string, mime?: string, size?: int, kind?: string}>  $attachments
     * @return string|list<array<string, mixed>>
     */
    public static function toLlmContent(string $text, array $attachments): string|array
    {
        $text = trim($text);
        $attachments = self::normalize($attachments);

        if ($attachments === []) {
            return $text;
        }

        $parts = [];
        $notes = [];

        if ($text !== '') {
            $parts[] = ['type' => 'text', 'text' => $text];
        }

        foreach ($attachments as $attachment) {
            if ($attachment['kind'] === 'image') {
                $dataUrl = self::imageDataUrl($attachment['url']);
                if ($dataUrl) {
                    $parts[] = [
                        'type' => 'image_url',
                        'image_url' => ['url' => $dataUrl],
                    ];

                    continue;
                }
            }

            $extracted = self::textExcerpt($attachment);
            if ($extracted !== null) {
                $notes[] = "Attached file \"{$attachment['name']}\":\n{$extracted}";

                continue;
            }

            if ($attachment['kind'] === 'image') {
                $notes[] = sprintf(
                    'The user attached an image named "%s", but the image bytes could not be loaded. Ask them to resend a smaller PNG or JPEG.',
                    $attachment['name'],
                );

                continue;
            }

            $notes[] = sprintf(
                'The user attached "%s"%s, but no readable text could be extracted. If it is scanned, encrypted, or a legacy .xls file, ask them to export CSV/TXT or paste the content.',
                $attachment['name'],
                $attachment['mime'] !== '' ? " ({$attachment['mime']})" : '',
            );
        }

        if ($notes !== []) {
            $parts[] = ['type' => 'text', 'text' => implode("\n\n", $notes)];
        }

        if (count($parts) === 1 && ($parts[0]['type'] ?? '') === 'text') {
            return (string) $parts[0]['text'];
        }

        if ($parts === []) {
            return $text !== '' ? $text : 'The user sent an attachment.';
        }

        return $parts;
    }

    public static function titleFrom(string $message, array $attachments): string
    {
        return GeneralChatTitle::fromMessage($message, $attachments);
    }

    private static function looksLikeImage(string $url, string $name): bool
    {
        return (bool) preg_match('/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i', $url.' '.$name);
    }

    private static function imageDataUrl(string $url): ?string
    {
        $relative = self::relativePublicPath($url);
        if (! $relative) {
            return null;
        }

        $bytes = self::readPublicFile($relative);
        if (! is_string($bytes) || $bytes === '') {
            return null;
        }

        $mime = 'image/jpeg';
        if (Storage::disk('public')->exists($relative)) {
            $detected = Storage::disk('public')->mimeType($relative);
            if (is_string($detected) && str_starts_with($detected, 'image/')) {
                $mime = $detected;
            }
        }

        if (strlen($bytes) > self::LLM_IMAGE_MAX_BYTES || in_array($mime, ['image/png', 'image/webp', 'image/bmp'], true)) {
            $compressed = self::compressImageForLlm($bytes);
            if (is_string($compressed) && $compressed !== '') {
                $bytes = $compressed;
                $mime = 'image/jpeg';
            }
        }

        if (strlen($bytes) > self::MAX_IMAGE_BYTES) {
            return null;
        }

        if (! str_starts_with($mime, 'image/')) {
            $mime = 'image/jpeg';
        }

        return 'data:'.$mime.';base64,'.base64_encode($bytes);
    }

    private static function readPublicFile(string $relative): ?string
    {
        if (Storage::disk('public')->exists($relative)) {
            $bytes = Storage::disk('public')->get($relative);
            if (is_string($bytes) && $bytes !== '') {
                return $bytes;
            }
        }

        $absolute = public_path('storage/'.$relative);
        if (is_file($absolute)) {
            $bytes = @file_get_contents($absolute);
            if (is_string($bytes) && $bytes !== '') {
                return $bytes;
            }
        }

        return null;
    }

    private static function compressImageForLlm(string $bytes): ?string
    {
        if (! function_exists('imagecreatefromstring')) {
            return strlen($bytes) <= self::LLM_IMAGE_MAX_BYTES ? $bytes : null;
        }

        $image = @imagecreatefromstring($bytes);
        if ($image === false) {
            return null;
        }

        $width = imagesx($image);
        $height = imagesy($image);
        if ($width < 1 || $height < 1) {
            imagedestroy($image);

            return null;
        }

        $scale = min(1, self::LLM_IMAGE_MAX_EDGE / max($width, $height));
        if ($scale < 1) {
            $newWidth = (int) max(1, round($width * $scale));
            $newHeight = (int) max(1, round($height * $scale));
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            if ($resized === false) {
                imagedestroy($image);

                return null;
            }
            imagecopyresampled($resized, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagedestroy($image);
            $image = $resized;
        }

        $quality = 82;
        $binary = null;
        while ($quality >= 45) {
            ob_start();
            imagejpeg($image, null, $quality);
            $binary = ob_get_clean() ?: '';
            if (strlen($binary) <= self::LLM_IMAGE_MAX_BYTES) {
                break;
            }
            $quality -= 8;
        }

        imagedestroy($image);

        return is_string($binary) && $binary !== '' ? $binary : null;
    }

    private static function textExcerpt(array $attachment): ?string
    {
        $mime = strtolower((string) ($attachment['mime'] ?? ''));
        $name = (string) ($attachment['name'] ?? '');

        $relative = self::relativePublicPath((string) $attachment['url']);
        if (! $relative) {
            return null;
        }

        $bytes = self::readPublicFile($relative);
        if (! is_string($bytes) || $bytes === '') {
            return null;
        }

        if (strlen($bytes) > self::MAX_IMAGE_BYTES) {
            return null;
        }

        $extracted = null;
        if (self::isPlainText($mime, $name)) {
            $extracted = trim((string) mb_convert_encoding($bytes, 'UTF-8', 'UTF-8'));
        } elseif (self::isPdf($mime, $name)) {
            $extracted = self::pdfText($bytes);
        } elseif (self::isSpreadsheet($mime, $name)) {
            $extracted = self::spreadsheetText($bytes);
        }

        return self::clipText($extracted);
    }

    private static function isPlainText(string $mime, string $name): bool
    {
        return str_starts_with($mime, 'text/')
            || in_array($mime, ['application/json', 'application/xml', 'application/javascript'], true)
            || (bool) preg_match('/\.(txt|md|csv|json|xml|html|css|js|log)$/i', $name);
    }

    private static function isPdf(string $mime, string $name): bool
    {
        return $mime === 'application/pdf' || (bool) preg_match('/\.pdf$/i', $name);
    }

    private static function isSpreadsheet(string $mime, string $name): bool
    {
        return in_array($mime, [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/vnd.oasis.opendocument.spreadsheet',
        ], true) || (bool) preg_match('/\.(xlsx|xlsm)$/i', $name);
    }

    private static function clipText(?string $text): ?string
    {
        $text = trim((string) $text);
        if ($text === '') {
            return null;
        }

        if (mb_strlen($text) > self::MAX_TEXT_CHARS) {
            return mb_substr($text, 0, self::MAX_TEXT_CHARS)."\n…[truncated]";
        }

        return $text;
    }

    private static function pdfText(string $bytes): ?string
    {
        if (! class_exists(\Smalot\PdfParser\Parser::class)) {
            return null;
        }

        try {
            $pdf = (new \Smalot\PdfParser\Parser)->parseContent($bytes);
            $text = trim((string) $pdf->getText());
        } catch (\Throwable) {
            return null;
        }

        return $text !== '' ? $text : null;
    }

    private static function spreadsheetText(string $bytes): ?string
    {
        if (! class_exists(\ZipArchive::class) || ! str_starts_with($bytes, 'PK')) {
            return null;
        }

        $tmp = tempnam(sys_get_temp_dir(), 'chatxlsx');
        if ($tmp === false) {
            return null;
        }

        $zip = new \ZipArchive;
        $opened = false;
        $lines = [];

        try {
            if (file_put_contents($tmp, $bytes) === false) {
                return null;
            }

            if ($zip->open($tmp) !== true) {
                return null;
            }
            $opened = true;

            $shared = [];
            $sharedXml = $zip->getFromName('xl/sharedStrings.xml');
            if (is_string($sharedXml) && $sharedXml !== '') {
                if (preg_match_all('/<t[^>]*>(.*?)<\/t>/s', $sharedXml, $matches)) {
                    foreach ($matches[1] as $value) {
                        $shared[] = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_XML1, 'UTF-8');
                    }
                }
            }

            $lines = [];
            for ($sheet = 1; $sheet <= 8; $sheet++) {
                $sheetXml = $zip->getFromName("xl/worksheets/sheet{$sheet}.xml");
                if (! is_string($sheetXml) || $sheetXml === '') {
                    if ($sheet > 1) {
                        continue;
                    }
                    break;
                }

                $sheetLines = self::sheetRows($sheetXml, $shared);
                if ($sheetLines === []) {
                    continue;
                }

                if ($sheet > 1) {
                    $lines[] = "Sheet {$sheet}:";
                }
                array_push($lines, ...$sheetLines);
            }
        } catch (\Throwable) {
            return null;
        } finally {
            if ($opened) {
                $zip->close();
            }
            @unlink($tmp);
        }

        $text = trim(implode("\n", $lines));

        return $text !== '' ? $text : null;
    }

    /**
     * @param  list<string>  $shared
     * @return list<string>
     */
    private static function sheetRows(string $sheetXml, array $shared): array
    {
        if (! preg_match_all('/<row\b[^>]*>(.*?)<\/row>/s', $sheetXml, $rows)) {
            return [];
        }

        $lines = [];
        foreach (array_slice($rows[1], 0, 400) as $rowXml) {
            $cells = [];
            if (! preg_match_all('/<c\b([^>]*)>(.*?)<\/c>/s', $rowXml, $cellMatches, PREG_SET_ORDER)) {
                continue;
            }

            foreach ($cellMatches as $cell) {
                $attrs = $cell[1];
                $body = $cell[2];
                $type = '';
                if (preg_match('/\bt="([^"]*)"/', $attrs, $typeMatch)) {
                    $type = strtolower($typeMatch[1]);
                }

                $value = '';
                if ($type === 's' && preg_match('/<v[^>]*>(.*?)<\/v>/s', $body, $valueMatch)) {
                    $index = (int) trim(html_entity_decode($valueMatch[1]));
                    $value = $shared[$index] ?? '';
                } elseif ($type === 'inlineStr' && preg_match('/<t[^>]*>(.*?)<\/t>/s', $body, $valueMatch)) {
                    $value = html_entity_decode(strip_tags($valueMatch[1]), ENT_QUOTES | ENT_XML1, 'UTF-8');
                } elseif (preg_match('/<v[^>]*>(.*?)<\/v>/s', $body, $valueMatch)) {
                    $value = trim(html_entity_decode(strip_tags($valueMatch[1]), ENT_QUOTES | ENT_XML1, 'UTF-8'));
                }

                $cells[] = $value;
            }

            $line = trim(implode("\t", $cells));
            if ($line !== '') {
                $lines[] = $line;
            }
        }

        return $lines;
    }

    private static function relativePublicPath(string $url): ?string
    {
        $canonical = PublicStorageUrl::canonicalize($url);
        if (! $canonical || ! str_starts_with($canonical, '/storage/')) {
            return null;
        }

        $relative = ltrim(substr($canonical, strlen('/storage/')), '/');
        $relative = rawurldecode($relative);

        return $relative !== '' ? $relative : null;
    }
}
