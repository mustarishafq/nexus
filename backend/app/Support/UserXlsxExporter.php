<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\AutoFilter;
use OpenSpout\Writer\Common\Entity\Sheet;
use OpenSpout\Writer\XLSX\Writer;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class UserXlsxExporter
{
    /**
     * @param  Builder<User>  $users
     */
    public function download(Builder $users, string $filename): BinaryFileResponse
    {
        $temporary = tempnam(sys_get_temp_dir(), 'users-export-');
        if ($temporary === false) {
            throw new RuntimeException('Unable to create the user export file.');
        }

        $path = $temporary.'.xlsx';
        if (! rename($temporary, $path)) {
            @unlink($temporary);
            throw new RuntimeException('Unable to create the user export file.');
        }

        try {
            $this->write($users, $path);
        } catch (Throwable $exception) {
            @unlink($path);
            throw $exception;
        }

        return response()
            ->download($path, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])
            ->deleteFileAfterSend(true);
    }

    /**
     * @param  Builder<User>  $users
     */
    public function write(Builder $users, string $path): void
    {
        $users->with([
            'accessGroups',
            'department',
            'company',
            'manager:id,email,full_name,name',
            'educations',
            'workExperiences',
            'userSkills',
        ]);

        $headerStyle = (new Style)->setFontBold();
        $children = [];
        $educations = [];
        $workExperiences = [];
        $skills = [];

        $writer = new Writer;
        $writer->openToFile($path);
        $userHeaders = $this->userHeaders();
        $userSheet = $writer->getCurrentSheet()->setName('Users');
        $writer->addRow(Row::fromValues($userHeaders, $headerStyle));
        $userCount = 0;

        foreach ($users->lazy(200) as $user) {
            $userCount++;
            $writer->addRow(Row::fromValues($this->userRow($user)));

            foreach ($this->childRows($user) as $row) {
                $children[] = $row;
            }
            foreach ($this->educationRows($user) as $row) {
                $educations[] = $row;
            }
            foreach ($this->workExperienceRows($user) as $row) {
                $workExperiences[] = $row;
            }
            foreach ($this->skillRows($user) as $row) {
                $skills[] = $row;
            }
        }

        $this->configureSheet($userSheet, $userHeaders, $userCount);
        $this->writeSheet($writer, 'Children', $this->childHeaders(), $children, $headerStyle);
        $this->writeSheet($writer, 'Education', $this->educationHeaders(), $educations, $headerStyle);
        $this->writeSheet($writer, 'Work Experience', $this->workExperienceHeaders(), $workExperiences, $headerStyle);
        $this->writeSheet($writer, 'Skills', $this->skillHeaders(), $skills, $headerStyle);
        $writer->close();
    }

    /**
     * @param  list<string>  $headers
     * @param  list<list<int|string>>  $rows
     */
    private function writeSheet(Writer $writer, string $name, array $headers, array $rows, Style $headerStyle): void
    {
        $sheet = $writer->addNewSheetAndMakeItCurrent()->setName($name);
        $writer->addRow(Row::fromValues($headers, $headerStyle));

        foreach ($rows as $row) {
            $writer->addRow(Row::fromValues($row));
        }

        $this->configureSheet($sheet, $headers, count($rows));
    }

    /**
     * @param  list<string>  $headers
     */
    private function configureSheet(Sheet $sheet, array $headers, int $dataRowCount): void
    {
        foreach ($headers as $index => $header) {
            $sheet->setColumnWidth($this->headerColumnWidth($header), $index + 1);
        }

        $lastColumn = max(count($headers) - 1, 0);
        $sheet->setAutoFilter(new AutoFilter(0, 1, $lastColumn, max($dataRowCount + 1, 1)));
    }

    private function headerColumnWidth(string $header): float
    {
        return (float) (mb_strlen($header) + 3);
    }

    /**
     * @return list<string>
     */
    private function userHeaders(): array
    {
        return [
            'ID',
            'Full Name',
            'Email',
            'Role',
            'Approved',
            'Job Title',
            'Employee ID',
            'Employment Type',
            'Company',
            'Department',
            'Manager Email',
            'Work Phone',
            'Personal Phone',
            'Home Phone',
            'Location',
            'Gender',
            'Place of Birth',
            'Nationality',
            'Religion',
            'Race',
            'Marital Status',
            'Marriage Leave Entitlement',
            'Current Address',
            'IC Number',
            'EPF Number',
            'SOCSO Number',
            'Income Tax Number',
            'Date of Birth',
            'Joined At',
            'Resigned At',
            'Emergency Contact Name',
            'Emergency Contact Phone',
            'Next of Kin Relationship',
            'Next of Kin IC Number',
            'Next of Kin Nationality',
            'Next of Kin Occupation',
            'Next of Kin Address',
            'Spouse Name',
            'Spouse IC Number',
            'Spouse Phone',
            'Spouse Occupation',
            'Spouse Employer',
            'Spouse Employer Address',
            'Spouse Date of Birth',
            'Spouse Marriage Date',
            'Health Conditions',
            'Health Notes',
            'MCP Access',
            'Access Groups',
            'Profile Completeness %',
            'Last Login',
            'Created At',
        ];
    }

    /**
     * @return list<int|string>
     */
    private function userRow(User $user): array
    {
        $spouse = is_array($user->spouse_details) ? $user->spouse_details : [];
        $completeness = ProfileCompleteness::forUser($user);

        return [
            $user->id,
            $this->text($user->full_name ?: $user->name),
            $this->text($user->email),
            $this->text($user->role),
            $user->is_approved ? 'yes' : 'no',
            $this->text($user->job_title),
            $this->text($user->employee_id),
            $this->text($user->employment_type),
            $this->text($user->company?->name),
            $this->text($user->department?->name),
            $this->text($user->manager?->email),
            $this->text($user->work_phone),
            $this->text($user->personal_phone),
            $this->text($user->home_phone),
            $this->text($user->location),
            $this->text($user->gender),
            $this->text($user->place_of_birth),
            $this->text($user->nationality),
            $this->text($user->religion),
            $this->text($user->race),
            $this->text($user->marital_status),
            $this->marriageLeave($user->marriage_leave_entitlement),
            $this->text($user->current_address),
            $this->text($user->ic_number),
            $this->text($user->epf_number),
            $this->text($user->socso_number),
            $this->text($user->income_tax_number),
            $this->date($user->date_of_birth),
            $this->date($user->joined_at),
            $this->date($user->resigned_at),
            $this->text($user->emergency_contact_name),
            $this->text($user->emergency_contact_phone),
            $this->text($user->next_of_kin_relationship),
            $this->text($user->next_of_kin_ic_number),
            $this->text($user->next_of_kin_nationality),
            $this->text($user->next_of_kin_occupation),
            $this->text($user->next_of_kin_address),
            $this->text($spouse['full_name'] ?? null),
            $this->text($spouse['ic_number'] ?? null),
            $this->text($spouse['phone'] ?? null),
            $this->text($spouse['occupation'] ?? null),
            $this->text($spouse['employer_name'] ?? null),
            $this->text($spouse['employer_address'] ?? null),
            $this->date($spouse['date_of_birth'] ?? null),
            $this->date($spouse['marriage_date'] ?? null),
            implode('; ', HealthStatus::labels($user->health_status)),
            $this->text(is_array($user->health_status) ? ($user->health_status['others'] ?? null) : null),
            $this->text($user->mcp_access),
            $user->accessGroups->pluck('name')->sort()->implode('; '),
            (int) ($completeness['percent'] ?? 0),
            $user->last_login_at?->toISOString() ?: 'Never login',
            $this->text($user->created_at?->toISOString()),
        ];
    }

    /**
     * @return list<string>
     */
    private function childHeaders(): array
    {
        return ['User ID', 'Full Name', 'Email', 'Child Name', 'IC Number', 'School', 'Date of Birth'];
    }

    /**
     * @return list<list<int|string>>
     */
    private function childRows(User $user): array
    {
        $children = is_array($user->children) ? $user->children : [];
        $rows = [];

        foreach ($children as $child) {
            if (! is_array($child)) {
                continue;
            }

            $rows[] = [
                $user->id,
                $this->text($user->full_name ?: $user->name),
                $this->text($user->email),
                $this->text($child['name'] ?? null),
                $this->text($child['ic_number'] ?? null),
                $this->text($child['school'] ?? null),
                $this->date($child['date_of_birth'] ?? null),
            ];
        }

        return $rows;
    }

    /**
     * @return list<string>
     */
    private function educationHeaders(): array
    {
        return ['User ID', 'Full Name', 'Email', 'Institution', 'Qualification', 'Field of Study', 'Year From', 'Year To'];
    }

    /**
     * @return list<list<int|string>>
     */
    private function educationRows(User $user): array
    {
        return $user->educations->map(fn ($education) => [
            $user->id,
            $this->text($user->full_name ?: $user->name),
            $this->text($user->email),
            $this->text($education->institution),
            $this->text($education->qualification),
            $this->text($education->field_of_study),
            $this->text($education->year_from),
            $this->text($education->year_to),
        ])->all();
    }

    /**
     * @return list<string>
     */
    private function workExperienceHeaders(): array
    {
        return ['User ID', 'Full Name', 'Email', 'Company', 'Job Title', 'Date From', 'Date To', 'Description'];
    }

    /**
     * @return list<list<int|string>>
     */
    private function workExperienceRows(User $user): array
    {
        return $user->workExperiences->map(fn ($experience) => [
            $user->id,
            $this->text($user->full_name ?: $user->name),
            $this->text($user->email),
            $this->text($experience->company),
            $this->text($experience->job_title),
            $this->text($experience->date_from),
            $this->text($experience->date_to),
            $this->text($experience->description),
        ])->all();
    }

    /**
     * @return list<string>
     */
    private function skillHeaders(): array
    {
        return ['User ID', 'Full Name', 'Email', 'Skill'];
    }

    /**
     * @return list<list<int|string>>
     */
    private function skillRows(User $user): array
    {
        return $user->userSkills->map(fn ($skill) => [
            $user->id,
            $this->text($user->full_name ?: $user->name),
            $this->text($user->email),
            $this->text($skill->name),
        ])->all();
    }

    private function marriageLeave(mixed $value): string
    {
        return match ($this->text($value)) {
            'not_yet_utilised' => 'Not yet utilised',
            'already_utilised' => 'Already utilised',
            default => $this->text($value),
        };
    }

    private function date(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        $text = $this->text($value);

        return $text === '' ? '' : substr($text, 0, 10);
    }

    private function text(mixed $value): string
    {
        return trim((string) ($value ?? ''));
    }
}
