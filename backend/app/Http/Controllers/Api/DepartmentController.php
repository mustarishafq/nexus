<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! ApiTokenAuth::userFromRequest($request)?->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $departments = Department::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json($departments);
    }

    public function store(Request $request): JsonResponse
    {
        if (! ApiTokenAuth::userFromRequest($request)?->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $department = Department::query()->firstOrCreate([
            'name' => trim($validated['name']),
        ]);

        return response()->json($department->only(['id', 'name']), $department->wasRecentlyCreated ? 201 : 200);
    }
}
