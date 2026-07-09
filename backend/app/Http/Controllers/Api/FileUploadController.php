<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\File;

class FileUploadController extends Controller
{
    use AuthorizesRoles;

    private const IMAGE_FOLDERS = [
        'profile-pictures',
        'cover-pictures',
        'cover-pictures-new',
        'post-images',
        'attendance-photos',
    ];

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'folder' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $folder = $validated['folder'] ?? 'uploads';

        if ($folder === 'splash-media') {
            if ($response = $this->authorizeAdmin($request)) {
                return $response;
            }

            $request->validate([
                'file' => [
                    'required',
                    File::types(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'mp4', 'webm', 'mov'])
                        ->max(51200),
                ],
            ]);
        } elseif ($folder === 'attendance-watermark-logos') {
            if ($response = $this->authorizeHrOrAdmin($request)) {
                return $response;
            }

            $request->validate([
                'file' => [
                    'required',
                    File::types(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'])
                        ->max(10240),
                ],
            ]);
        } elseif (in_array($folder, self::IMAGE_FOLDERS, true)) {
            $request->validate([
                'file' => ['required', 'file', 'max:10240', 'image', 'mimes:jpeg,jpg,png,webp,gif'],
            ]);
        } else {
            $request->validate([
                'file' => ['required', 'file', 'max:10240'],
            ]);
        }

        $file = $request->file('file');
        $path = $file->store($folder, 'public');
        $url = Storage::url($path);
        $mime = (string) $file->getMimeType();

        return response()->json([
            'file_url' => $url,
            'path' => $path,
            'media_type' => str_starts_with($mime, 'video/') ? 'video' : 'image',
            'mime_type' => $mime,
        ], 201);
    }
}
