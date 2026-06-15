<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class UserHrCsvImportTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('a', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_hr_onboarding_csv_creates_user_with_hr_fields(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $token = $this->issueToken($admin);

        $csv = implode("\n", [
            'email,full_name,job_title,department,ic_number,work_phone,gender,nationality',
            'new.hire@example.com,Jane Doe,Sales Executive,Operations,900101-01-1234,0192704323,female,Malaysian',
        ]);

        $file = UploadedFile::fake()->createWithContent('hr.csv', $csv);

        $this->withToken($token)
            ->post('/api/users/import-hr-onboarding-csv', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('created.0', 'new.hire@example.com');

        $user = User::query()->where('email', 'new.hire@example.com')->first();
        $this->assertNotNull($user);
        $this->assertSame('Jane Doe', $user->full_name);
        $this->assertSame('Sales Executive', $user->job_title);
        $this->assertSame('900101-01-1234', $user->ic_number);
        $this->assertSame('+60192704323', $user->work_phone);
        $this->assertSame('female', $user->gender);
        $this->assertSame('Malaysian', $user->nationality);
        $this->assertNotNull($user->department_id);
    }

    public function test_hr_onboarding_csv_updates_existing_user(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $token = $this->issueToken($admin);

        User::factory()->create([
            'email' => 'existing@example.com',
            'full_name' => 'Old Name',
            'is_approved' => true,
        ]);

        $csv = implode("\n", [
            'email,full_name,employee_id,epf_number,emergency_contact_name,emergency_contact_phone,next_of_kin_relationship',
            'existing@example.com,Existing User,EMP-99,EPF123,Emergency Person,0123456789,Mother',
        ]);

        $file = UploadedFile::fake()->createWithContent('hr.csv', $csv);

        $this->withToken($token)
            ->post('/api/users/import-hr-onboarding-csv', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('updated.0', 'existing@example.com');

        $user = User::query()->where('email', 'existing@example.com')->first();
        $this->assertSame('Existing User', $user->full_name);
        $this->assertSame('EMP-99', $user->employee_id);
        $this->assertSame('EPF123', $user->epf_number);
        $this->assertSame('Emergency Person', $user->emergency_contact_name);
        $this->assertSame('+60123456789', $user->emergency_contact_phone);
        $this->assertSame('Mother', $user->next_of_kin_relationship);
    }
}
