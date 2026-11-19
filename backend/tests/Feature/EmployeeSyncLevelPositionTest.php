<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\EmployeeSyncApplyService;
use App\Support\EmployeeSyncSerializer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeSyncLevelPositionTest extends TestCase
{
    use RefreshDatabase;

    public function test_level_position_is_synced_and_can_be_cleared(): void
    {
        $user = User::factory()->create(['email' => 'staff@emzi.com.my']);

        app(EmployeeSyncApplyService::class)->apply([[
            'nexus_user_id' => (string) $user->id,
            'email' => 'staff@emzi.com.my',
            'job_title' => 'Senior Executive',
            'level_position' => 'E2',
        ]]);

        $user->refresh();
        $this->assertSame('Senior Executive', $user->job_title);
        $this->assertSame('E2', $user->level_position);

        app(EmployeeSyncApplyService::class)->apply([[
            'nexus_user_id' => (string) $user->id,
            'email' => 'staff@emzi.com.my',
            'level_position' => null,
        ]]);

        $this->assertNull($user->fresh()->level_position);
    }

    public function test_serializer_includes_level_position(): void
    {
        $user = User::factory()->create(['level_position' => 'M1']);

        $row = EmployeeSyncSerializer::serialize($user);

        $this->assertSame('M1', $row['level_position']);
    }
}
