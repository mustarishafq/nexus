<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_educations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('institution', 150);
            $table->string('qualification', 150)->nullable();
            $table->string('field_of_study', 150)->nullable();
            $table->string('year_from', 10)->nullable();
            $table->string('year_to', 10)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['user_id', 'sort_order']);
        });

        Schema::create('user_work_experiences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('company', 150);
            $table->string('job_title', 150)->nullable();
            $table->string('date_from', 20)->nullable();
            $table->string('date_to', 20)->nullable();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['user_id', 'sort_order']);
        });

        Schema::create('user_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'name']);
            $table->index(['user_id', 'sort_order']);
        });

        $this->migrateJsonColumn('education_history', function (int $userId, array $items): void {
            foreach ($items as $index => $item) {
                if (! is_array($item)) {
                    continue;
                }

                $institution = trim((string) ($item['institution'] ?? ''));
                if ($institution === '') {
                    continue;
                }

                DB::table('user_educations')->insert([
                    'user_id' => $userId,
                    'institution' => mb_substr($institution, 0, 150),
                    'qualification' => $this->nullableString($item['qualification'] ?? null, 150),
                    'field_of_study' => $this->nullableString($item['field_of_study'] ?? null, 150),
                    'year_from' => $this->nullableString($item['year_from'] ?? null, 10),
                    'year_to' => $this->nullableString($item['year_to'] ?? null, 10),
                    'sort_order' => $index,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        $this->migrateJsonColumn('work_history', function (int $userId, array $items): void {
            foreach ($items as $index => $item) {
                if (! is_array($item)) {
                    continue;
                }

                $company = trim((string) ($item['company'] ?? ''));
                if ($company === '') {
                    continue;
                }

                DB::table('user_work_experiences')->insert([
                    'user_id' => $userId,
                    'company' => mb_substr($company, 0, 150),
                    'job_title' => $this->nullableString($item['job_title'] ?? null, 150),
                    'date_from' => $this->nullableString($item['date_from'] ?? null, 20),
                    'date_to' => $this->nullableString($item['date_to'] ?? null, 20),
                    'description' => $this->nullableString($item['description'] ?? null, 500),
                    'sort_order' => $index,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        $this->migrateJsonColumn('skills', function (int $userId, array $items): void {
            $seen = [];

            foreach ($items as $index => $item) {
                $name = trim(is_string($item) ? $item : (string) ($item['name'] ?? ''));
                if ($name === '') {
                    continue;
                }

                $name = mb_substr($name, 0, 50);
                $key = strtolower($name);
                if (isset($seen[$key])) {
                    continue;
                }

                $seen[$key] = true;

                DB::table('user_skills')->insert([
                    'user_id' => $userId,
                    'name' => $name,
                    'sort_order' => $index,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'education_history')) {
                $table->dropColumn('education_history');
            }

            if (Schema::hasColumn('users', 'work_history')) {
                $table->dropColumn('work_history');
            }

            if (Schema::hasColumn('users', 'skills')) {
                $table->dropColumn('skills');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'skills')) {
                $table->json('skills')->nullable()->after('location');
            }

            if (! Schema::hasColumn('users', 'education_history')) {
                $table->json('education_history')->nullable()->after('gender');
            }

            if (! Schema::hasColumn('users', 'work_history')) {
                $table->json('work_history')->nullable()->after('education_history');
            }
        });

        $users = DB::table('users')->pluck('id');

        foreach ($users as $userId) {
            $skills = DB::table('user_skills')
                ->where('user_id', $userId)
                ->orderBy('sort_order')
                ->pluck('name')
                ->values()
                ->all();

            $education = DB::table('user_educations')
                ->where('user_id', $userId)
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($row) => [
                    'institution' => $row->institution,
                    'qualification' => $row->qualification,
                    'field_of_study' => $row->field_of_study,
                    'year_from' => $row->year_from,
                    'year_to' => $row->year_to,
                ])
                ->values()
                ->all();

            $workHistory = DB::table('user_work_experiences')
                ->where('user_id', $userId)
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($row) => [
                    'company' => $row->company,
                    'job_title' => $row->job_title,
                    'date_from' => $row->date_from,
                    'date_to' => $row->date_to,
                    'description' => $row->description,
                ])
                ->values()
                ->all();

            DB::table('users')->where('id', $userId)->update([
                'skills' => $skills === [] ? null : json_encode($skills),
                'education_history' => $education === [] ? null : json_encode($education),
                'work_history' => $workHistory === [] ? null : json_encode($workHistory),
            ]);
        }

        Schema::dropIfExists('user_skills');
        Schema::dropIfExists('user_work_experiences');
        Schema::dropIfExists('user_educations');
    }

    private function migrateJsonColumn(string $column, callable $migrateItems): void
    {
        if (! Schema::hasColumn('users', $column)) {
            return;
        }

        DB::table('users')
            ->select(['id', $column])
            ->whereNotNull($column)
            ->orderBy('id')
            ->chunkById(100, function ($users) use ($column, $migrateItems) {
                foreach ($users as $user) {
                    $raw = $user->{$column};
                    $items = is_string($raw) ? json_decode($raw, true) : $raw;

                    if (! is_array($items) || $items === []) {
                        continue;
                    }

                    $migrateItems((int) $user->id, $items);
                }
            });
    }

    private function nullableString(mixed $value, int $maxLength): ?string
    {
        $string = trim((string) ($value ?? ''));
        if ($string === '') {
            return null;
        }

        return mb_substr($string, 0, $maxLength);
    }
};
