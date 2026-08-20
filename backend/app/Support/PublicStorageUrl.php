<?php

namespace App\Support;

class PublicStorageUrl
{
    /**
     * Persist and expose public-disk files as /storage/... so clients are not
     * tied to APP_URL or an /api prefix. External URLs are left unchanged.
     */
    public static function canonicalize(mixed $url): ?string
    {
        if (! is_string($url)) {
            return null;
        }

        $trimmed = trim($url);
        if ($trimmed === '') {
            return null;
        }

        $path = $trimmed;
        if (preg_match('#^https?://#i', $trimmed) === 1) {
            $parsedPath = parse_url($trimmed, PHP_URL_PATH);
            if (is_string($parsedPath) && $parsedPath !== '') {
                $path = $parsedPath;
            }
        } elseif (! str_starts_with($path, '/')) {
            $path = '/'.$path;
        }

        $storagePos = strpos($path, '/storage/');
        if ($storagePos !== false) {
            return substr($path, $storagePos);
        }

        return $trimmed;
    }
}
