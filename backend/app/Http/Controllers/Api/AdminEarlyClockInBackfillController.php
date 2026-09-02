<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\ExpReward;
use App\Services\EarlyClockInBackfillService;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class AdminEarlyClockInBackfillController extends Controller
{
    use AuthorizesRoles;

    public function store(Request $request, EarlyClockInBackfillService $backfill): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::GAMIFICATION_AWARD_MANUAL)) {
            return $response;
        }

        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'user' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:pending,claimed'],
            'dry_run' => ['sometimes', 'boolean'],
        ]);

        try {
            $userFilter = trim((string) ($validated['user'] ?? ''));

            $stats = $backfill->run(
                date: $validated['date'],
                dateTo: $validated['date_to'] ?? null,
                userFilter: $userFilter !== '' ? $userFilter : null,
                status: $validated['status'] ?? ExpReward::STATUS_PENDING,
                dryRun: (bool) ($validated['dry_run'] ?? false),
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Could not recalculate Early clock-in EXP. Try a shorter date range or a single user.',
            ], 500);
        }

        return response()->json($stats);
    }
}
