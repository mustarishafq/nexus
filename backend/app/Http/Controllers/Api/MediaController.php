<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use League\Flysystem\PathTraversalDetected;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class MediaController extends Controller
{
    public function show(Request $request): BinaryFileResponse
    {
        $path = $this->resolvePublicDiskPath($request);

        if ($path === '' || str_contains($path, '..')) {
            abort(404);
        }

        try {
            $disk = Storage::disk('public');
            abort_unless($disk->exists($path), 404);
            abort_unless(is_file($disk->path($path)), 404);

            $headers = ['Cache-Control' => 'public, max-age=31536000, immutable'];
            $origin = $request->headers->get('Origin');
            $allowedOrigins = array_values(array_filter([
                env('APP_URL'),
                env('FRONTEND_URL'),
            ]));

            if ($origin && in_array($origin, $allowedOrigins, true)) {
                $headers['Access-Control-Allow-Origin'] = $origin;
                $headers['Vary'] = 'Origin';
            }

            return response()->file($disk->path($path), $headers);
        } catch (PathTraversalDetected) {
            abort(404);
        }
    }

    private function resolvePublicDiskPath(Request $request): string
    {
        $requestPath = trim($request->path(), '/');
        $prefix = 'api/media/';

        if (str_starts_with($requestPath, $prefix)) {
            return Str::after($requestPath, $prefix);
        }

        $routePath = (string) $request->route('path', '');

        return trim($routePath, '/');
    }
}
