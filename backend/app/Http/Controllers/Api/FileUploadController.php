<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FileUploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:10240'],
            'folder' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $folder = $validated['folder'] ?? 'uploads';
        $path = $request->file('file')->store($folder, 'public');
        $url = Storage::url($path);

        return response()->json([
            'file_url' => $url,
            'path' => $path,
        ], 201);
    }
}
