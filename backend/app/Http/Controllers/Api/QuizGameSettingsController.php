<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Support\PermissionCatalog;
use App\Support\QuizGameSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuizGameSettingsController extends Controller
{
    use AuthorizesRoles;

    public function show(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::QUIZ_MANAGE)) {
            return $response;
        }

        return response()->json(QuizGameSettings::payload());
    }

    public function update(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::QUIZ_MANAGE)) {
            return $response;
        }

        $validated = $request->validate(QuizGameSettings::validationRules());
        $validated['live_exp_enabled'] = $request->boolean('live_exp_enabled');
        QuizGameSettings::save($validated);

        return response()->json(QuizGameSettings::payload());
    }
}
