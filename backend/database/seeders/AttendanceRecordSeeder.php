<?php

namespace Database\Seeders;

use App\Models\AttendanceRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class AttendanceRecordSeeder extends Seeder
{
    private const SEED_TAG = 'attendance_dummy';

    /**
     * @return array<int, array{
     *   days_ago: int,
     *   clock_in: string,
     *   clock_out: string,
     *   location: string,
     *   shift_name: string,
     *   standard_minutes: int,
     * }>
     */
    private function scenarios(): array
    {
        return [
            [
                'days_ago' => 0,
                'clock_in' => '09:13',
                'clock_out' => '21:43',
                'location' => 'EMZI HQ (SP Plaza)',
                'shift_name' => 'Day Shift',
                'standard_minutes' => 480,
            ],
            [
                'days_ago' => 1,
                'clock_in' => '08:55',
                'clock_out' => '21:15',
                'location' => 'EMZI HQ (SP Plaza)',
                'shift_name' => 'Day Shift',
                'standard_minutes' => 480,
            ],
            [
                'days_ago' => 2,
                'clock_in' => '09:02',
                'clock_out' => '18:05',
                'location' => 'EMZI HQ (SP Plaza)',
                'shift_name' => 'Day Shift',
                'standard_minutes' => 480,
            ],
            [
                'days_ago' => 3,
                'clock_in' => '08:48',
                'clock_out' => '19:30',
                'location' => 'Client Site — Bangsar South',
                'shift_name' => 'Day Shift',
                'standard_minutes' => 480,
            ],
            [
                'days_ago' => 4,
                'clock_in' => '09:20',
                'clock_out' => '17:58',
                'location' => 'EMZI HQ (SP Plaza)',
                'shift_name' => 'Day Shift',
                'standard_minutes' => 480,
            ],
            [
                'days_ago' => 5,
                'clock_in' => '10:05',
                'clock_out' => '22:40',
                'location' => 'EMZI HQ (SP Plaza)',
                'shift_name' => 'Day Shift',
                'standard_minutes' => 480,
            ],
            [
                'days_ago' => 6,
                'clock_in' => '09:00',
                'clock_out' => '18:00',
                'location' => 'Remote — Home Office',
                'shift_name' => 'Day Shift',
                'standard_minutes' => 480,
            ],
        ];
    }

    public function run(): void
    {
        $seedEmail = env('ATTENDANCE_SEED_USER_EMAIL', 'admin@admin.com');

        $user = User::query()
            ->where('email', $seedEmail)
            ->where('is_approved', true)
            ->first();

        if (! $user) {
            $this->command?->warn("User [{$seedEmail}] not found. Skipping attendance dummy data.");

            return;
        }

        AttendanceRecord::query()
            ->where('user_id', $user->id)
            ->where('metadata->seed', self::SEED_TAG)
            ->delete();

        $timezone = config('app.timezone');
        $created = 0;

        foreach ($this->scenarios() as $index => $scenario) {
            $day = Carbon::now($timezone)->subDays($scenario['days_ago'])->startOfDay();
            $clockInAt = $day->copy()->setTimeFromTimeString($scenario['clock_in']);
            $clockOutAt = $day->copy()->setTimeFromTimeString($scenario['clock_out']);

            if ($clockOutAt->lessThanOrEqualTo($clockInAt)) {
                $clockOutAt->addDay();
            }

            $workedMinutes = (int) $clockInAt->diffInMinutes($clockOutAt);
            $overtimeMinutes = max(0, $workedMinutes - $scenario['standard_minutes']);

            $shared = [
                'user_id' => $user->id,
                'photo_url' => sprintf('https://picsum.photos/seed/nexus-attendance-%d-%d/480/640', $user->id, $index),
                'latitude' => 3.1185000,
                'longitude' => 101.6770000,
                'location_label' => $scenario['location'],
                'browser' => 'Chrome',
                'browser_version' => '126.0',
                'operating_system' => 'macOS',
                'device_type' => 'desktop',
                'screen_resolution' => '1920x1080',
                'timezone' => $timezone,
                'ip_address' => '127.0.0.1',
            ];

            AttendanceRecord::query()->create(array_merge($shared, [
                'type' => 'clock_in',
                'metadata' => [
                    'seed' => self::SEED_TAG,
                    'policy' => [
                        'shift_name' => $scenario['shift_name'],
                        'matched_site_name' => $scenario['location'],
                        'distance_meters' => 8.4 + $index,
                    ],
                ],
                'captured_at' => $clockInAt,
            ]));

            AttendanceRecord::query()->create(array_merge($shared, [
                'type' => 'clock_out',
                'metadata' => [
                    'seed' => self::SEED_TAG,
                    'policy' => array_filter([
                        'shift_name' => $overtimeMinutes > 0 ? null : $scenario['shift_name'],
                        'worked_minutes' => $workedMinutes,
                        'standard_minutes' => $scenario['standard_minutes'],
                        'overtime_minutes' => $overtimeMinutes,
                        'is_overtime' => $overtimeMinutes > 0,
                    ], fn ($value) => $value !== null),
                ],
                'captured_at' => $clockOutAt,
            ]));

            $created += 2;
        }

        $this->command?->info(sprintf(
            'Seeded %d attendance records for %s.',
            $created,
            $user->email,
        ));
    }
}
