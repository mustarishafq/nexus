<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanyController extends Controller
{
    use AuthorizesRoles;

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $companies = Company::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json($companies);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $company = Company::query()->firstOrCreate([
            'name' => trim($validated['name']),
        ]);

        return response()->json($company->only(['id', 'name']), $company->wasRecentlyCreated ? 201 : 200);
    }
}
