<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\PathTraversalDetected;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaController extends Controller
{
    public function show(Request $request, string $path): StreamedResponse
    {
        if (str_contains($path, '..')) {
            abort(404);
        }

        try {
            abort_unless(Storage::disk('public')->exists($path), 404);

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

            return Storage::disk('public')->response($path, headers: $headers);
        } catch (PathTraversalDetected) {
            abort(404);
        }
    }
}
