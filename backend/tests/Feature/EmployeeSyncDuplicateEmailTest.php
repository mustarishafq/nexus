<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\User;
use App\Services\EmployeeSyncApplyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeSyncDuplicateEmailTest extends TestCase
{
    use RefreshDatabase;

    public function test_duplicate_email_does_not_abort_department_sync(): void
    {
        $target = User::factory()->create([
            'email' => 'live@emzi.com.my',
            'full_name' => 'Live User',
        ]);
        User::factory()->create([
            'email' => 'other@gmail.com',
            'full_name' => 'Other User',
        ]);
        $department = Department::query()->create(['name' => 'Procurement']);

        $stats = app(EmployeeSyncApplyService::class)->apply([
            [
                'nexus_user_id' => (string) $target->id,
                'email' => 'other@gmail.com',
                'full_name' => 'Live User',
                'name' => 'Live User',
                'department_name' => 'Procurement',
            ],
            [
                'nexus_user_id' => (string) $target->id,
                'email' => 'live@emzi.com.my',
                'full_name' => 'Live User',
                'name' => 'Live User',
                'department_name' => 'Procurement',
            ],
        ]);

        $target->refresh();

        $this->assertSame('live@emzi.com.my', $target->email);
        $this->assertSame($department->id, $target->department_id);
        $this->assertSame(2, $stats['updated']);
        $this->assertSame(0, $stats['skipped']);
    }
}
