<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NetworkHealthAlert;
use App\Models\NetworkHealthLog;
use App\Models\User;
use App\Services\NetworkHealthAlertService;
use App\Support\ApiTokenAuth;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class NetworkHealthController extends Controller
{
    private const DOWNLOAD_TEST_BYTES = 262144;

    private const UPLOAD_TEST_BYTES = 131072;

    public function __construct(
        private readonly NetworkHealthAlertService $alertService
    ) {}

    public function ping(Request $request): JsonResponse
    {
        if ($response = $this->authorizeUser($request)) {
            return $response;
        }

        return response()->json([
            'timestamp' => now()->toISOString(),
            'server_time_ms' => (int) round(microtime(true) * 1000),
        ]);
    }

    public function downloadTest(Request $request): Response
    {
        if ($response = $this->authorizeUser($request)) {
            return $response;
        }

        $payload = str_repeat('0', self::DOWNLOAD_TEST_BYTES);

        return response($payload, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => (string) self::DOWNLOAD_TEST_BYTES,
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    public function uploadTest(Request $request): JsonResponse
    {
        if ($response = $this->authorizeUser($request)) {
            return $response;
        }

        $request->validate([
            'file' => ['required', 'file', 'max:512'],
        ]);

        $bytes = (int) $request->file('file')->getSize();

        return response()->json([
            'received_bytes' => $bytes,
            'timestamp' => now()->toISOString(),
        ]);
    }

    public function clientInfo(Request $request): JsonResponse
    {
        if ($response = $this->authorizeUser($request)) {
            return $response;
        }

        return response()->json([
            'ip_address' => $request->ip(),
        ]);
    }

    public function storeLog(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'latency_ms' => ['nullable', 'integer', 'min:0', 'max:60000'],
            'download_mbps' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'upload_mbps' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'browser' => ['nullable', 'string', 'max:64'],
            'browser_version' => ['nullable', 'string', 'max:32'],
            'operating_system' => ['nullable', 'string', 'max:64'],
            'device_type' => ['nullable', 'string', 'max:32'],
            'screen_resolution' => ['nullable', 'string', 'max:32'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'ip_address' => ['nullable', 'string', 'max:45'],
            'tested_at' => ['required', 'date'],
        ]);

        $testedAt = Carbon::parse($validated['tested_at']);

        $recentDuplicate = NetworkHealthLog::query()
            ->where('user_id', $user->id)
            ->where('tested_at', '>=', $testedAt->copy()->subMinutes(55))
            ->exists();

        if ($recentDuplicate) {
            return response()->json(['message' => 'A recent test already exists for this user.'], 409);
        }

        $log = NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => $validated['latency_ms'] ?? null,
            'download_mbps' => $validated['download_mbps'] ?? null,
            'upload_mbps' => $validated['upload_mbps'] ?? null,
            'browser' => $validated['browser'] ?? null,
            'browser_version' => $validated['browser_version'] ?? null,
            'operating_system' => $validated['operating_system'] ?? null,
            'device_type' => $validated['device_type'] ?? null,
            'screen_resolution' => $validated['screen_resolution'] ?? null,
            'timezone' => $validated['timezone'] ?? null,
            'ip_address' => $validated['ip_address'] ?? $request->ip(),
            'tested_at' => $testedAt,
        ]);

        $alerts = $this->alertService->evaluateAndCreate($log);

        return response()->json([
            'log' => $log->load('user:id,full_name,name,email'),
            'alerts_created' => count($alerts),
        ], 201);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $isAdmin = $user->role === 'admin';

        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'access_group_id' => ['nullable', 'integer', 'exists:access_groups,id'],
            'browser' => ['nullable', 'string', 'max:64'],
            'operating_system' => ['nullable', 'string', 'max:64'],
        ]);

        if (! $isAdmin) {
            $validated['user_id'] = $user->id;
            unset($validated['access_group_id']);
        }

        $dateFrom = isset($validated['date_from'])
            ? Carbon::parse($validated['date_from'])->startOfDay()
            : now()->subDays(7)->startOfDay();
        $dateTo = isset($validated['date_to'])
            ? Carbon::parse($validated['date_to'])->endOfDay()
            : now()->endOfDay();

        $baseQuery = $this->filteredLogsQuery($validated, $dateFrom, $dateTo);

        $summary = (clone $baseQuery)
            ->selectRaw('AVG(latency_ms) as avg_latency_ms')
            ->selectRaw('AVG(download_mbps) as avg_download_mbps')
            ->selectRaw('AVG(upload_mbps) as avg_upload_mbps')
            ->first();

        $usersTestedToday = $isAdmin
            ? NetworkHealthLog::query()
                ->whereDate('tested_at', now()->toDateString())
                ->distinct('user_id')
                ->count('user_id')
            : NetworkHealthLog::query()
                ->where('user_id', $user->id)
                ->whereDate('tested_at', now()->toDateString())
                ->count();

        $hourBucketSql = match (DB::connection()->getDriverName()) {
            'sqlite' => "strftime('%Y-%m-%d %H:00:00', tested_at)",
            'pgsql' => "to_char(tested_at, 'YYYY-MM-DD HH24:00:00')",
            default => "DATE_FORMAT(tested_at, '%Y-%m-%d %H:00:00')",
        };

        $hourlyTrends = (clone $baseQuery)
            ->selectRaw("{$hourBucketSql} as hour_bucket")
            ->selectRaw('AVG(latency_ms) as avg_latency_ms')
            ->selectRaw('AVG(download_mbps) as avg_download_mbps')
            ->selectRaw('AVG(upload_mbps) as avg_upload_mbps')
            ->groupBy('hour_bucket')
            ->orderBy('hour_bucket')
            ->get()
            ->map(fn ($row) => [
                'hour_bucket' => Carbon::parse($row->hour_bucket, config('app.timezone'))->toIso8601String(),
                'avg_latency_ms' => $row->avg_latency_ms !== null ? round((float) $row->avg_latency_ms, 1) : null,
                'avg_download_mbps' => $row->avg_download_mbps !== null ? round((float) $row->avg_download_mbps, 2) : null,
                'avg_upload_mbps' => $row->avg_upload_mbps !== null ? round((float) $row->avg_upload_mbps, 2) : null,
            ])
            ->values();

        $latestResults = (clone $baseQuery)
            ->with('user:id,full_name,name,email')
            ->orderByDesc('tested_at')
            ->limit(25)
            ->get();

        $slowestUsers = $isAdmin
            ? (clone $baseQuery)
                ->select('user_id')
                ->selectRaw('AVG(latency_ms) as avg_latency_ms')
                ->selectRaw('MAX(tested_at) as last_tested_at')
                ->whereNotNull('latency_ms')
                ->groupBy('user_id')
                ->orderByDesc('avg_latency_ms')
                ->limit(10)
                ->get()
                ->map(function ($row) {
                    $rowUser = User::query()->find($row->user_id, ['id', 'full_name', 'name', 'email']);

                    return [
                        'user_id' => $row->user_id,
                        'user' => $rowUser,
                        'avg_latency_ms' => round((float) $row->avg_latency_ms, 1),
                        'last_tested_at' => Carbon::parse($row->last_tested_at)->toISOString(),
                    ];
                })
            : collect();

        $lowestDownloadUsers = $isAdmin
            ? (clone $baseQuery)
                ->select('user_id')
                ->selectRaw('AVG(download_mbps) as avg_download_mbps')
                ->selectRaw('MAX(tested_at) as last_tested_at')
                ->whereNotNull('download_mbps')
                ->groupBy('user_id')
                ->orderBy('avg_download_mbps')
                ->limit(10)
                ->get()
                ->map(function ($row) {
                    $rowUser = User::query()->find($row->user_id, ['id', 'full_name', 'name', 'email']);

                    return [
                        'user_id' => $row->user_id,
                        'user' => $rowUser,
                        'avg_download_mbps' => round((float) $row->avg_download_mbps, 2),
                        'last_tested_at' => Carbon::parse($row->last_tested_at)->toISOString(),
                    ];
                })
            : collect();

        $activeAlertsQuery = NetworkHealthAlert::query()
            ->with(['user:id,full_name,name,email', 'log'])
            ->where('status', 'active')
            ->orderByDesc('created_at')
            ->limit(50);

        if (! $isAdmin) {
            $activeAlertsQuery->where('user_id', $user->id);
        }

        $activeAlerts = $activeAlertsQuery->get();

        return response()->json([
            'scope' => $isAdmin ? 'admin' : 'self',
            'summary' => [
                'avg_latency_ms' => $summary->avg_latency_ms ? round((float) $summary->avg_latency_ms, 1) : null,
                'avg_download_mbps' => $summary->avg_download_mbps ? round((float) $summary->avg_download_mbps, 2) : null,
                'avg_upload_mbps' => $summary->avg_upload_mbps ? round((float) $summary->avg_upload_mbps, 2) : null,
                'users_tested_today' => $usersTestedToday,
            ],
            'hourly_trends' => $hourlyTrends,
            'latest_results' => $latestResults,
            'slowest_users' => $slowestUsers,
            'lowest_download_users' => $lowestDownloadUsers,
            'active_alerts' => $activeAlerts,
            'averages' => [
                'daily' => $this->periodAverages($validated, now()->startOfDay(), now()->endOfDay()),
                'weekly' => $this->periodAverages($validated, now()->startOfWeek(), now()->endOfWeek()),
                'monthly' => $this->periodAverages($validated, now()->startOfMonth(), now()->endOfMonth()),
            ],
            'filters' => [
                'date_from' => $dateFrom->toDateString(),
                'date_to' => $dateTo->toDateString(),
            ],
        ]);
    }

    public function userHistory(Request $request, User $user): JsonResponse
    {
        $authUser = ApiTokenAuth::userFromRequest($request);

        if (! $authUser || ! $authUser->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($authUser->role !== 'admin' && $authUser->id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $logs = NetworkHealthLog::query()
            ->where('user_id', $user->id)
            ->orderByDesc('tested_at')
            ->limit(100)
            ->get();

        return response()->json([
            'user' => $user->only(['id', 'full_name', 'name', 'email']),
            'history' => $logs,
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse|JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $isAdmin = $user->role === 'admin';

        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'access_group_id' => ['nullable', 'integer', 'exists:access_groups,id'],
            'browser' => ['nullable', 'string', 'max:64'],
            'operating_system' => ['nullable', 'string', 'max:64'],
        ]);

        if (! $isAdmin) {
            $validated['user_id'] = $user->id;
            unset($validated['access_group_id']);
        }

        $dateFrom = isset($validated['date_from'])
            ? Carbon::parse($validated['date_from'])->startOfDay()
            : now()->subDays(30)->startOfDay();
        $dateTo = isset($validated['date_to'])
            ? Carbon::parse($validated['date_to'])->endOfDay()
            : now()->endOfDay();

        $logs = $this->filteredLogsQuery($validated, $dateFrom, $dateTo)
            ->with('user:id,full_name,name,email')
            ->orderByDesc('tested_at')
            ->get();

        $filename = 'network-health-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($logs) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'ID', 'User', 'Email', 'Latency (ms)', 'Download (Mbps)', 'Upload (Mbps)',
                'Browser', 'Browser Version', 'OS', 'Device', 'Screen', 'Timezone', 'IP', 'Tested At',
            ]);

            foreach ($logs as $log) {
                fputcsv($handle, [
                    $log->id,
                    $log->user?->full_name ?: $log->user?->name,
                    $log->user?->email,
                    $log->latency_ms,
                    $log->download_mbps,
                    $log->upload_mbps,
                    $log->browser,
                    $log->browser_version,
                    $log->operating_system,
                    $log->device_type,
                    $log->screen_resolution,
                    $log->timezone,
                    $log->ip_address,
                    $log->tested_at?->toISOString(),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function acknowledgeAlert(Request $request, NetworkHealthAlert $networkHealthAlert): JsonResponse
    {
        $admin = ApiTokenAuth::userFromRequest($request);

        if (! $admin) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($admin->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $networkHealthAlert->update([
            'status' => 'acknowledged',
            'acknowledged_by' => $admin->id,
            'acknowledged_at' => now(),
        ]);

        return response()->json($networkHealthAlert->fresh(['user:id,full_name,name,email', 'log']));
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function filteredLogsQuery(array $filters, Carbon $dateFrom, Carbon $dateTo): Builder
    {
        $query = NetworkHealthLog::query()
            ->whereBetween('tested_at', [$dateFrom, $dateTo]);

        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (! empty($filters['access_group_id'])) {
            $groupId = (int) $filters['access_group_id'];
            $query->whereHas('user.accessGroups', fn (Builder $q) => $q->where('access_groups.id', $groupId));
        }

        if (! empty($filters['browser'])) {
            $query->where('browser', $filters['browser']);
        }

        if (! empty($filters['operating_system'])) {
            $query->where('operating_system', $filters['operating_system']);
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, float|null>
     */
    private function periodAverages(array $filters, Carbon $from, Carbon $to): array
    {
        $summary = $this->filteredLogsQuery($filters, $from, $to)
            ->selectRaw('AVG(latency_ms) as avg_latency_ms')
            ->selectRaw('AVG(download_mbps) as avg_download_mbps')
            ->selectRaw('AVG(upload_mbps) as avg_upload_mbps')
            ->first();

        return [
            'avg_latency_ms' => $summary->avg_latency_ms ? round((float) $summary->avg_latency_ms, 1) : null,
            'avg_download_mbps' => $summary->avg_download_mbps ? round((float) $summary->avg_download_mbps, 2) : null,
            'avg_upload_mbps' => $summary->avg_upload_mbps ? round((float) $summary->avg_upload_mbps, 2) : null,
        ];
    }

    private function authorizeUser(Request $request): ?JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return null;
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }
}
