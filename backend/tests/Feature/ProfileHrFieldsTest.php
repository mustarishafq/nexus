<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\ProfileCompleteness;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileHrFieldsTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('h', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_user_can_save_children_spouse_and_health_status(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->patchJson('/api/me', [
                'spouse_details' => [
                    'full_name' => 'Aisha',
                    'ic_number' => '880202-14-5678',
                ],
                'children' => [
                    [
                        'name' => 'Ali',
                        'ic_number' => '160315-14-1111',
                        'school' => 'SK Ampang',
                        'age' => '9',
                    ],
                ],
                'health_status' => [
                    'conditions' => ['high_blood_pressure', 'others'],
                    'others' => 'Asthma',
                ],
            ])
            ->assertOk()
            ->assertJsonPath('spouse_details.full_name', 'Aisha')
            ->assertJsonPath('spouse_details.date_of_birth', '1988-02-02')
            ->assertJsonPath('children.0.name', 'Ali')
            ->assertJsonPath('children.0.school', 'SK Ampang')
            ->assertJsonPath('children.0.date_of_birth', '2016-03-15')
            ->assertJsonMissingPath('children.0.age')
            ->assertJsonPath('health_status.conditions.0', 'high_blood_pressure')
            ->assertJsonPath('health_status.others', 'Asthma');
    }

    public function test_ic_number_autofills_empty_date_of_birth(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'date_of_birth' => null,
            'ic_number' => null,
        ]);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->patchJson('/api/me', [
                'ic_number' => '900101-01-1234',
            ])
            ->assertOk()
            ->assertJsonPath('ic_number', '900101-01-1234')
            ->assertJsonPath('date_of_birth', '1990-01-01');
    }

    public function test_ic_number_does_not_overwrite_existing_date_of_birth(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'date_of_birth' => '1988-05-20',
            'ic_number' => null,
        ]);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->patchJson('/api/me', [
                'ic_number' => '900101-01-1234',
            ])
            ->assertOk()
            ->assertJsonPath('ic_number', '900101-01-1234')
            ->assertJsonPath('date_of_birth', '1988-05-20');
    }

    public function test_health_status_rejects_none_combined_with_other_conditions(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->patchJson('/api/me', [
                'health_status' => [
                    'conditions' => ['none', 'migraine'],
                ],
            ])
            ->assertUnprocessable();
    }

    public function test_health_status_is_required_for_profile_completeness(): void
    {
        $department = \App\Models\Department::query()->create(['name' => 'Engineering']);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'Display',
            'full_name' => 'Full Name',
            'profile_picture' => 'https://example.com/p.jpg',
            'cover_picture' => 'https://example.com/c.jpg',
            'bio' => 'Hello',
            'department_id' => $department->id,
            'work_phone' => '123',
            'date_of_birth' => '1990-01-01',
            'joined_at' => '2020-01-01',
            'gender' => 'male',
            'nationality' => 'Malaysian',
            'ic_number' => '900101-01-1234',
            'current_address' => '123 Street',
            'emergency_contact_name' => 'Kin',
            'emergency_contact_phone' => '456',
            'next_of_kin_relationship' => 'Spouse',
        ]);
        $user->educations()->create([
            'institution' => 'Test University',
            'qualification' => 'Degree',
            'field_of_study' => 'CS',
            'year_from' => '2010',
            'year_to' => '2014',
            'sort_order' => 0,
        ]);

        $this->assertLessThan(100, ProfileCompleteness::forUser($user->fresh())['percent']);

        $user->forceFill([
            'health_status' => ['conditions' => ['none'], 'others' => null],
        ])->save();

        $this->assertSame(100, ProfileCompleteness::forUser($user->fresh())['percent']);
    }
}
