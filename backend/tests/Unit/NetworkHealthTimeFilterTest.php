<?php

namespace Tests\Unit;

use App\Models\NetworkHealthLog;
use App\Models\User;
use App\Support\NetworkHealthTimeFilter;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NetworkHealthTimeFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_apply_limits_results_to_time_window(): void
    {
        $timezone = (string) config('app.timezone');
        $user = User::factory()->create(['is_approved' => true]);
        $day = Carbon::parse('2026-06-10 00:00:00', $timezone);

        NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 100,
            'tested_at' => $day->copy()->setTime(10, 0, 0),
        ]);

        NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 500,
            'tested_at' => $day->copy()->setTime(20, 0, 0),
        ]);

        $filter = NetworkHealthTimeFilter::fromValues('09:00', '17:00', $timezone);
        $query = NetworkHealthLog::query()->whereBetween(
            'tested_at',
            [$day->copy()->startOfDay(), $day->copy()->endOfDay()]
        );
        $filter->apply($query, $day->copy()->startOfDay(), $day->copy()->endOfDay());

        $this->assertSame([100], $query->orderBy('latency_ms')->pluck('latency_ms')->all());
    }

    public function test_apply_uses_requested_timezone(): void
    {
        $timezone = (string) config('app.timezone');
        $user = User::factory()->create(['is_approved' => true]);
        $day = Carbon::parse('2026-06-10', $timezone);

        NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 100,
            'tested_at' => $day->copy()->setTime(10, 0, 0),
        ]);

        NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 500,
            'tested_at' => $day->copy()->setTime(18, 0, 0),
        ]);

        $filter = NetworkHealthTimeFilter::fromValues('09:00', '17:30', $timezone);
        $query = NetworkHealthLog::query()->whereBetween(
            'tested_at',
            [
                $day->copy()->startOfDay()->timezone($timezone),
                $day->copy()->endOfDay()->timezone($timezone),
            ]
        );
        $filter->apply($query, $day->copy()->startOfDay(), $day->copy()->endOfDay());

        $this->assertSame([100], $query->orderBy('latency_ms')->pluck('latency_ms')->all());
    }
}
