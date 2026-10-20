<?php

namespace Tests\Feature;

use App\Models\AccessGroup;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use OpenSpout\Reader\XLSX\Reader;
use Tests\TestCase;
use ZipArchive;

class UserHrRoleTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('h', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_hr_can_list_users(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->getJson('/api/users')
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_hr_can_list_users_paginated_with_filters(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr', 'full_name' => 'HR Person']);
        User::factory()->create(['is_approved' => true, 'role' => 'user', 'full_name' => 'Alice Example', 'email' => 'alice@example.com']);
        User::factory()->create(['is_approved' => false, 'role' => 'user', 'full_name' => 'Bob Pending', 'email' => 'bob@example.com']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->getJson('/api/users?page=1&per_page=20&q=Alice&status=approved')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.page', 1)
            ->assertJsonPath('data.0.email', 'alice@example.com')
            ->assertJsonStructure([
                'data',
                'meta' => [
                    'total',
                    'page',
                    'per_page',
                    'last_page',
                    'stats' => [
                        'total',
                        'admins',
                        'hr',
                        'approved',
                        'pending',
                        'incomplete_profiles',
                    ],
                ],
            ]);
    }

    public function test_hr_can_filter_users_by_department_and_access_group(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $department = Department::query()->create(['name' => 'Engineering']);
        $otherDepartment = Department::query()->create(['name' => 'Finance']);
        $group = AccessGroup::query()->create([
            'name' => 'Engineering Access',
            'description' => null,
        ]);
        $otherGroup = AccessGroup::query()->create([
            'name' => 'Finance Access',
            'description' => null,
        ]);

        $matched = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Matched User',
            'email' => 'matched@example.com',
            'department_id' => $department->id,
        ]);
        $matched->accessGroups()->attach($group->id);

        $wrongDepartment = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Wrong Department',
            'email' => 'wrong.dept@example.com',
            'department_id' => $otherDepartment->id,
        ]);
        $wrongDepartment->accessGroups()->attach($group->id);

        $wrongGroup = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Wrong Group',
            'email' => 'wrong.group@example.com',
            'department_id' => $department->id,
        ]);
        $wrongGroup->accessGroups()->attach($otherGroup->id);

        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->getJson("/api/users?page=1&per_page=20&department_id={$department->id}&access_group_id={$group->id}")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.email', 'matched@example.com');
    }

    public function test_hr_can_import_hr_onboarding_csv(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = $this->issueToken($hr);

        $csv = implode("\n", [
            'email,full_name,job_title',
            'hr.created@example.com,HR Created,Analyst',
        ]);

        $file = UploadedFile::fake()->createWithContent('hr.csv', $csv);

        $this->withToken($token)
            ->post('/api/users/import-hr-onboarding-csv', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('count', 1);
    }

    public function test_hr_cannot_import_standard_user_csv(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = $this->issueToken($hr);

        $csv = "full_name,email,password\nJane Doe,jane@example.com,Password@123";
        $file = UploadedFile::fake()->createWithContent('users.csv', $csv);

        $this->withToken($token)
            ->post('/api/users/import-csv', ['file' => $file])
            ->assertForbidden();
    }

    public function test_hr_cannot_update_admin_user(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin', 'full_name' => 'Admin User']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->patchJson("/api/users/{$admin->id}", ['full_name' => 'Changed Name'])
            ->assertForbidden();
    }

    public function test_hr_can_nudge_incomplete_profiles(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Incomplete User',
            'name' => '',
        ]);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->postJson('/api/users/nudge-incomplete-profiles')
            ->assertOk();
    }

    public function test_hr_can_load_attendance_settings(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->getJson('/api/admin/app-settings')
            ->assertOk()
            ->assertJsonStructure([
                'attendance',
                'attendance_datetime_formats',
                'attendance_watermark_positions',
            ]);
    }

    public function test_hr_can_update_attendance_settings(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->patchJson('/api/admin/app-settings', [
                'attendance_enabled' => true,
                'attendance_watermark_show_user_name' => false,
                'attendance_watermark_position' => 'bottom-right',
            ])
            ->assertOk()
            ->assertJsonPath('attendance.show_user_name', false)
            ->assertJsonPath('attendance.position', 'bottom-right');
    }

    public function test_admin_can_export_users_csv(): void
    {
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'full_name' => 'Admin Exporter',
            'email' => 'admin.export@example.com',
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Export Target',
            'email' => 'export.target@example.com',
            'last_login_at' => null,
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Logged In User',
            'email' => 'logged.in@example.com',
            'last_login_at' => '2026-07-15 08:30:00',
        ]);
        $token = $this->issueToken($admin);

        $response = $this->withToken($token)->get('/api/users/export');

        $response->assertOk();
        $this->assertStringContainsString(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            (string) $response->headers->get('content-type')
        );
        $this->assertStringContainsString('.xlsx', (string) $response->headers->get('content-disposition'));
        $sheets = $this->workbookSheets($response);
        $users = $this->sheetRowsByHeader($sheets['Users']);
        $this->assertSame(['Children', 'Education', 'Work Experience', 'Skills'], array_values(array_diff(array_keys($sheets), ['Users'])));
        $this->assertSame('Never login', $users['export.target@example.com']['Last Login']);
        $this->assertStringContainsString('2026-07-15', $users['logged.in@example.com']['Last Login']);
    }

    public function test_admin_can_export_users_csv_filtered_by_never_logged_in(): void
    {
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'full_name' => 'Admin Never Filter',
            'email' => 'admin.never.filter@example.com',
            'last_login_at' => '2026-07-10 12:00:00',
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Never Logged In',
            'email' => 'never.logged.in@example.com',
            'last_login_at' => null,
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Has Logged In',
            'email' => 'has.logged.in@example.com',
            'last_login_at' => '2026-07-15 08:30:00',
        ]);
        $token = $this->issueToken($admin);

        $response = $this->withToken($token)->get('/api/users/export?login=never');

        $response->assertOk();
        $users = $this->sheetRowsByHeader($this->workbookSheets($response)['Users']);
        $this->assertArrayHasKey('never.logged.in@example.com', $users);
        $this->assertSame('Never login', $users['never.logged.in@example.com']['Last Login']);
        $this->assertArrayNotHasKey('has.logged.in@example.com', $users);
        $this->assertArrayNotHasKey('admin.never.filter@example.com', $users);
    }

    public function test_admin_can_filter_users_by_last_login_older_than_14_days(): void
    {
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'email' => 'admin.old.login@example.com',
            'last_login_at' => now()->subDays(3),
        ]);
        $stale = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'stale.login@example.com',
            'last_login_at' => now()->subDays(16),
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'recent.login@example.com',
            'last_login_at' => now()->subDays(5),
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'never.for.old.filter@example.com',
            'last_login_at' => null,
        ]);
        $token = $this->issueToken($admin);

        $response = $this->withToken($token)
            ->getJson('/api/users?login=older_than_14_days&page=1&per_page=50')
            ->assertOk();

        $emails = collect($response->json('data'))->pluck('email')->all();
        $this->assertContains($stale->email, $emails);
        $this->assertNotContains('recent.login@example.com', $emails);
        $this->assertNotContains('never.for.old.filter@example.com', $emails);
        $this->assertNotContains($admin->email, $emails);
    }

    public function test_hr_can_export_users_csv(): void
    {
        $hr = User::factory()->create([
            'is_approved' => true,
            'role' => 'hr',
            'full_name' => 'HR Exporter',
            'email' => 'hr.export@example.com',
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'HR Export Target',
            'email' => 'hr.export.target@example.com',
        ]);
        $token = $this->issueToken($hr);

        $response = $this->withToken($token)->get('/api/users/export');

        $response->assertOk();
        $users = $this->sheetRowsByHeader($this->workbookSheets($response)['Users']);
        $this->assertArrayHasKey('hr.export.target@example.com', $users);
    }

    public function test_user_export_splits_one_to_many_records_onto_their_own_sheets(): void
    {
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'email' => 'admin.family.export@example.com',
        ]);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Family Export',
            'email' => 'family.export@example.com',
            'ic_number' => '800101-14-1234',
            'spouse_details' => [
                'full_name' => 'Spouse Export',
                'ic_number' => '820202-14-5678',
                'date_of_birth' => '1982-02-02',
            ],
            'children' => [
                [
                    'name' => 'Ali',
                    'ic_number' => '160315-14-1111',
                    'school' => 'SK Ampang',
                    'date_of_birth' => '2016-03-15',
                ],
                [
                    'name' => 'Siti',
                    'ic_number' => null,
                    'school' => 'Tadika',
                    'date_of_birth' => '2018-01-01',
                ],
            ],
            'health_status' => [
                'conditions' => ['migraine'],
                'others' => null,
            ],
        ]);
        $user->educations()->create([
            'institution' => 'Universiti Malaya',
            'qualification' => 'Degree',
            'field_of_study' => 'Accounting',
            'year_from' => '2010',
            'year_to' => '2014',
            'sort_order' => 0,
        ]);
        $user->workExperiences()->create([
            'company' => 'Emzi',
            'job_title' => 'Executive',
            'date_from' => '2015-01',
            'date_to' => '2020-06',
            'description' => 'Finance',
            'sort_order' => 0,
        ]);
        $user->userSkills()->create([
            'name' => 'Excel',
            'sort_order' => 0,
        ]);
        $token = $this->issueToken($admin);

        $sheets = $this->workbookSheets($this->withToken($token)->get('/api/users/export'));
        $users = $this->sheetRowsByHeader($sheets['Users']);
        $children = array_values(array_filter(
            $this->sheetRowsByHeader($sheets['Children'], 'Child Name'),
            fn (array $row) => $row['Email'] === 'family.export@example.com'
        ));
        $education = $this->sheetRowsByHeader($sheets['Education'], 'Institution');
        $experience = $this->sheetRowsByHeader($sheets['Work Experience'], 'Company');
        $skills = $this->sheetRowsByHeader($sheets['Skills'], 'Skill');

        $this->assertSame('800101-14-1234', $users['family.export@example.com']['IC Number']);
        $this->assertSame('Spouse Export', $users['family.export@example.com']['Spouse Name']);
        $this->assertSame('1982-02-02', $users['family.export@example.com']['Spouse Date of Birth']);
        $this->assertSame('Migraine', $users['family.export@example.com']['Health Conditions']);
        $this->assertCount(2, $children);
        $this->assertSame('2016-03-15', $children[0]['Date of Birth']);
        $this->assertSame('SK Ampang', $children[0]['School']);
        $this->assertSame('2018-01-01', $children[1]['Date of Birth']);
        $this->assertSame('Accounting', $education['Universiti Malaya']['Field of Study']);
        $this->assertSame('Executive', $experience['Emzi']['Job Title']);
        $this->assertSame('family.export@example.com', $skills['Excel']['Email']);
        $this->assertArrayNotHasKey('admin.family.export@example.com', $this->sheetRowsByHeader($sheets['Children']));
    }

    /**
     * @return array<string, list<list<mixed>>>
     */
    private function workbookSheets(TestResponse $response): array
    {
        $response->assertOk();
        $path = tempnam(sys_get_temp_dir(), 'users-export-test-');
        $this->assertNotFalse($path);
        $xlsxPath = $path.'.xlsx';
        rename($path, $xlsxPath);
        file_put_contents($xlsxPath, $response->streamedContent());

        $zip = new ZipArchive;
        $this->assertTrue($zip->open($xlsxPath));
        $reader = new Reader;
        $reader->open($xlsxPath);
        $sheets = [];
        foreach ($reader->getSheetIterator() as $sheet) {
            $rows = [];
            foreach ($sheet->getRowIterator() as $row) {
                $rows[] = $row->toArray();
            }
            $sheets[$sheet->getName()] = $rows;

            $headers = array_map(fn ($header) => (string) $header, $rows[0] ?? []);
            $widths = $sheet->getColumnWidths();
            $this->assertCount(count($headers), $widths);
            foreach ($headers as $index => $header) {
                $this->assertSame($index + 1, $widths[$index]->start);
                $this->assertSame($index + 1, $widths[$index]->end);
                $this->assertEqualsWithDelta(mb_strlen($header) + 3, $widths[$index]->width, 0.01);
            }

            $xml = $zip->getFromName('xl/worksheets/sheet'.($sheet->getIndex() + 1).'.xml');
            $this->assertIsString($xml);
            $lastColumn = $this->columnLetters(max(count($headers) - 1, 0));
            $this->assertStringContainsString(
                '<autoFilter ref="A1:'.$lastColumn.count($rows).'"/>',
                $xml
            );
        }
        $reader->close();
        $zip->close();
        @unlink($xlsxPath);

        return $sheets;
    }

    /**
     * @param  list<list<mixed>>  $rows
     * @return array<string, array<string, mixed>>
     */
    private function sheetRowsByHeader(array $rows, string $key = 'Email'): array
    {
        $headers = array_map(fn ($header) => (string) $header, $rows[0] ?? []);
        $indexed = [];
        foreach (array_slice($rows, 1) as $row) {
            $record = [];
            foreach ($headers as $index => $header) {
                $record[$header] = $row[$index] ?? '';
            }
            $indexed[(string) ($record[$key] ?? '')] = $record;
        }

        return $indexed;
    }

    private function columnLetters(int $index): string
    {
        $letters = '';
        $index++;

        while ($index > 0) {
            $index--;
            $letters = chr(65 + ($index % 26)).$letters;
            $index = intdiv($index, 26);
        }

        return $letters;
    }

    public function test_regular_user_cannot_export_users_csv(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->get('/api/users/export')
            ->assertForbidden();
    }
}
