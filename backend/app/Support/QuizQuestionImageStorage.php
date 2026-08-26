<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class QuizQuestionImageStorage
{
    public const FOLDER = 'quiz-question-images';

    public static function relativePath(?string $url): ?string
    {
        $canonical = PublicStorageUrl::canonicalize($url);
        if (! $canonical || ! str_starts_with($canonical, '/storage/'.self::FOLDER.'/')) {
            return null;
        }

        $relative = ltrim(substr($canonical, strlen('/storage/')), '/');
        if ($relative === '' || str_contains($relative, '..')) {
            return null;
        }

        return $relative;
    }

    public static function delete(?string $url): void
    {
        $path = self::relativePath($url);
        if (! $path) {
            return;
        }

        Storage::disk('public')->delete($path);
    }

    /**
     * @param  list<string|null>  $oldUrls
     * @param  list<string|null>  $newUrls
     */
    public static function deleteUnused(array $oldUrls, array $newUrls): void
    {
        $kept = [];
        foreach ($newUrls as $url) {
            $path = self::relativePath(is_string($url) ? $url : null);
            if ($path) {
                $kept[$path] = true;
            }
        }

        foreach ($oldUrls as $url) {
            $path = self::relativePath(is_string($url) ? $url : null);
            if ($path && ! isset($kept[$path])) {
                Storage::disk('public')->delete($path);
            }
        }
    }
}
