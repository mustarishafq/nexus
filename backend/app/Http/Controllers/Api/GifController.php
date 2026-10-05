<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Services\GiphyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GifController extends Controller
{
    use AuthorizesRoles;

    public function index(Request $request, GiphyService $giphy): JsonResponse
    {
        if (! $this->authenticatedUser($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        if (! $giphy->isEnabled()) {
            return response()->json(['enabled' => false, 'gifs' => []]);
        }

        $query = trim((string) ($validated['q'] ?? ''));

        return response()->json([
            'enabled' => true,
            'gifs' => $query === '' ? $giphy->trending() : $giphy->search($query),
        ]);
    }
}
