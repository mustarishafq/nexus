<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserTodo;
use App\Services\UserTodoService;
use App\Support\ApiTokenAuth;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserTodoController extends Controller
{
    use AppliesIndexQuery;

    public function __construct(
        protected UserTodoService $userTodoService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = UserTodo::query()
            ->where('user_id', $user->id)
            ->whereNull('completed_at')
            ->where(function (Builder $inner) {
                $inner->whereNull('notification_id')
                    ->orWhereHas('notification', function (Builder $notification) {
                        $notification->where(function (Builder $snooze) {
                            $snooze->whereNull('snoozed_until')
                                ->orWhere('snoozed_until', '<=', now());
                        });
                    });
            });

        $query = $this->applyIndexQuery($request, $query, [], '-created_date');
        $items = $query->get();

        return response()->json($items);
    }

    public function complete(Request $request, UserTodo $userTodo): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($userTodo->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($userTodo->completed_at) {
            return response()->json($userTodo);
        }

        $item = $this->userTodoService->complete($userTodo);

        return response()->json($item);
    }

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }
}
