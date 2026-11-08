<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\User;
use Carbon\Carbon;

class InsanAttendancePushService
{
    public function __construct(
        private readonly ResourceAttendanceForwarder $forwarder,
    ) {}

    /**
     * @param  list<int>  $recordIds
     * @return array{
     *     total: int,
     *     pushed: int,
     *     retried_with_fallback: int,
     *     skipped: int,
     *     failed: int,
     *     dry_run: bool,
     *     legacy_fallback: bool,
     *     failures: list<array{id: int, email: ?string, type: string, captured_at: ?string, error: ?string}>
     * }
     */
    public function push(
        ?Carbon $from = null,
        ?Carbon $to = null,
        ?string $userFilter = null,
        array $recordIds = [],
        bool $dryRun = false,
        int $chunkSize = 200,
        bool $legacyFallback = false,
        ?string $legacyReason = null,
    ): array {
        $application = $this->forwarder->resolveResourceApplication();
        if (! $application || ! $application->base_url || ! $application->api_key) {
            throw new \RuntimeException('Insan/Resource application is not configured (enabled, base_url, api_key).');
        }

        $query = AttendanceRecord::query()
            ->with(['user.department'])
            ->where(function ($q) {
                $q->whereNull('source')
                    ->orWhere('source', '')
                    ->orWhere('source', 'brain');
            })
            ->orderBy('captured_at')
            ->orderBy('id');

        if ($from) {
            $query->where('captured_at', '>=', $from);
        }

        if ($to) {
            $query->where('captured_at', '<=', $to);
        }

        if ($userFilter !== null && trim($userFilter) !== '') {
            $trimmed = trim($userFilter);
            if (ctype_digit($trimmed)) {
                $query->where('user_id', (int) $trimmed);
            } else {
                $matchedUserIds = User::query()
                    ->where('email', strtolower($trimmed))
                    ->orWhere('email', 'like', '%'.strtolower($trimmed).'%')
                    ->pluck('id')
                    ->all();
                $query->whereIn('user_id', $matchedUserIds ?: [-1]);
            }
        }

        $cleanIds = array_values(array_filter(array_map('intval', $recordIds), fn (int $id) => $id > 0));
        if ($cleanIds !== []) {
            $query->whereIn('id', $cleanIds);
        }

        $stats = [
            'total' => 0,
            'pushed' => 0,
            'retried_with_fallback' => 0,
            'skipped' => 0,
            'failed' => 0,
            'dry_run' => $dryRun,
            'legacy_fallback' => $legacyFallback,
            'failures' => [],
        ];

        $chunkSize = max(1, min(1000, $chunkSize));

        foreach ($query->lazy($chunkSize) as $record) {
            $stats['total']++;

            if ($dryRun) {
                $stats['pushed']++;
                continue;
            }

            $result = $this->forwarder->forwardWithResult(
                record: $record,
                user: $record->user,
                allowLegacyFallback: $legacyFallback,
                legacyReason: $legacyReason,
            );
            $status = $result['status'];

            if ($status === 'pushed') {
                $stats['pushed']++;
            } elseif ($status === 'retried_with_fallback') {
                $stats['retried_with_fallback']++;
            } elseif ($status === 'skipped') {
                $stats['skipped']++;
            } else {
                $stats['failed']++;
                if (count($stats['failures']) < 50) {
                    $stats['failures'][] = [
                        'id' => (int) $record->id,
                        'email' => $record->user?->email,
                        'type' => (string) $record->type,
                        'captured_at' => $record->captured_at?->toIso8601String(),
                        'error' => $result['error'] ?? null,
                    ];
                }
            }
        }

        return $stats;
    }
}
