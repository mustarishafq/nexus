<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Validates the optional photo / GIF on a feed comment. Photos must be files
 * this app uploaded to comment-images; GIFs must come from GIPHY's CDN, so a
 * comment can never embed an arbitrary third-party URL.
 */
class CommentAttachment
{
    public const TYPE_IMAGE = 'image';

    public const TYPE_GIF = 'gif';

    public const IMAGE_FOLDER = 'comment-images';

    private const GIPHY_HOST_PATTERN = '/^(media\d*|i)\.giphy\.com$/i';

    /**
     * @param  array<string, mixed>|null  $input
     * @return array{attachment_type: string, attachment_url: string, attachment_width: ?int, attachment_height: ?int}|null
     */
    public static function normalize(?array $input): ?array
    {
        if (! $input) {
            return null;
        }

        $type = (string) ($input['type'] ?? '');
        $url = trim((string) ($input['url'] ?? ''));

        $normalizedUrl = match ($type) {
            self::TYPE_IMAGE => self::normalizeImageUrl($url),
            self::TYPE_GIF => self::normalizeGifUrl($url),
            default => null,
        };

        if ($normalizedUrl === null) {
            throw ValidationException::withMessages([
                'attachment.url' => $type === self::TYPE_GIF
                    ? 'GIFs must be picked from the GIF search.'
                    : 'Upload the photo before posting the comment.',
            ]);
        }

        return [
            'attachment_type' => $type,
            'attachment_url' => $normalizedUrl,
            'attachment_width' => self::dimension($input['width'] ?? null),
            'attachment_height' => self::dimension($input['height'] ?? null),
        ];
    }

    private static function normalizeImageUrl(string $url): ?string
    {
        $canonical = PublicStorageUrl::canonicalize($url);
        $prefix = '/storage/'.self::IMAGE_FOLDER.'/';

        if (! $canonical || ! str_starts_with($canonical, $prefix) || str_contains($canonical, '..')) {
            return null;
        }

        $relative = substr($canonical, strlen('/storage/'));

        return Storage::disk('public')->exists($relative) ? $canonical : null;
    }

    private static function normalizeGifUrl(string $url): ?string
    {
        $parts = parse_url($url);
        $host = $parts['host'] ?? '';

        if (($parts['scheme'] ?? '') !== 'https' || ! preg_match(self::GIPHY_HOST_PATTERN, $host)) {
            return null;
        }

        return $url;
    }

    private static function dimension(mixed $value): ?int
    {
        $int = filter_var($value, FILTER_VALIDATE_INT);

        return $int !== false && $int > 0 && $int <= 10000 ? $int : null;
    }
}
