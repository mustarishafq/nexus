<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('access_group_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('access_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('application_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['access_group_id', 'application_id']);
        });

        Schema::create('user_system_access_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_system_access_id')->constrained()->cascadeOnDelete();
            $table->foreignId('application_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_system_access_id', 'application_id'], 'user_system_access_app_unique');
        });

        Schema::create('application_private_access_emails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->cascadeOnDelete();
            $table->string('email', 255);
            $table->timestamps();

            $table->unique(['application_id', 'email']);
            $table->index('email');
        });

        Schema::create('metabase_dashboard_access_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('metabase_dashboard_id')->constrained()->cascadeOnDelete();
            $table->foreignId('access_group_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['metabase_dashboard_id', 'access_group_id'], 'dashboard_access_group_unique');
        });

        Schema::create('metabase_dashboard_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('metabase_dashboard_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['metabase_dashboard_id', 'user_id'], 'dashboard_user_unique');
        });

        Schema::create('calendar_event_attendees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('calendar_event_id')->constrained()->cascadeOnDelete();
            $table->string('email', 255);
            $table->timestamps();

            $table->unique(['calendar_event_id', 'email']);
            $table->index('email');
        });

        $applicationIdsBySlug = DB::table('applications')->pluck('id', 'slug');

        $this->migrateSlugJsonColumn(
            'access_groups',
            'allowed_system_slugs',
            function (int $parentId, array $slugs) use ($applicationIdsBySlug): void {
                $this->insertApplicationSlugs('access_group_applications', 'access_group_id', $parentId, $slugs, $applicationIdsBySlug);
            }
        );

        $this->migrateSlugJsonColumn(
            'user_system_accesses',
            'allowed_system_slugs',
            function (int $parentId, array $slugs) use ($applicationIdsBySlug): void {
                $this->insertApplicationSlugs('user_system_access_applications', 'user_system_access_id', $parentId, $slugs, $applicationIdsBySlug);
            }
        );

        $this->migrateEmailJsonColumn(
            'applications',
            'private_allowed_user_emails',
            'application_private_access_emails',
            'application_id'
        );

        $this->migrateIdJsonColumn(
            'metabase_dashboards',
            'access_group_ids',
            'metabase_dashboard_access_groups',
            'metabase_dashboard_id',
            'access_group_id',
            'access_groups'
        );

        $this->migrateIdJsonColumn(
            'metabase_dashboards',
            'user_ids',
            'metabase_dashboard_users',
            'metabase_dashboard_id',
            'user_id',
            'users'
        );

        $this->migrateEmailJsonColumn(
            'calendar_events',
            'attendee_emails',
            'calendar_event_attendees',
            'calendar_event_id'
        );

        Schema::table('access_groups', function (Blueprint $table) {
            if (Schema::hasColumn('access_groups', 'allowed_system_slugs')) {
                $table->dropColumn('allowed_system_slugs');
            }
        });

        Schema::table('user_system_accesses', function (Blueprint $table) {
            if (Schema::hasColumn('user_system_accesses', 'allowed_system_slugs')) {
                $table->dropColumn('allowed_system_slugs');
            }
        });

        Schema::table('applications', function (Blueprint $table) {
            if (Schema::hasColumn('applications', 'private_allowed_user_emails')) {
                $table->dropColumn('private_allowed_user_emails');
            }
        });

        Schema::table('metabase_dashboards', function (Blueprint $table) {
            if (Schema::hasColumn('metabase_dashboards', 'access_group_ids')) {
                $table->dropColumn('access_group_ids');
            }

            if (Schema::hasColumn('metabase_dashboards', 'user_ids')) {
                $table->dropColumn('user_ids');
            }
        });

        Schema::table('calendar_events', function (Blueprint $table) {
            if (Schema::hasColumn('calendar_events', 'attendee_emails')) {
                $table->dropColumn('attendee_emails');
            }
        });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            if (! Schema::hasColumn('calendar_events', 'attendee_emails')) {
                $table->json('attendee_emails')->nullable();
            }
        });

        Schema::table('metabase_dashboards', function (Blueprint $table) {
            if (! Schema::hasColumn('metabase_dashboards', 'access_group_ids')) {
                $table->json('access_group_ids')->nullable();
            }

            if (! Schema::hasColumn('metabase_dashboards', 'user_ids')) {
                $table->json('user_ids')->nullable();
            }
        });

        Schema::table('applications', function (Blueprint $table) {
            if (! Schema::hasColumn('applications', 'private_allowed_user_emails')) {
                $table->json('private_allowed_user_emails')->nullable();
            }
        });

        Schema::table('user_system_accesses', function (Blueprint $table) {
            if (! Schema::hasColumn('user_system_accesses', 'allowed_system_slugs')) {
                $table->json('allowed_system_slugs')->nullable();
            }
        });

        Schema::table('access_groups', function (Blueprint $table) {
            if (! Schema::hasColumn('access_groups', 'allowed_system_slugs')) {
                $table->json('allowed_system_slugs')->nullable();
            }
        });

        $this->restoreSlugJsonFromPivot(
            'access_groups',
            'allowed_system_slugs',
            'access_group_applications',
            'access_group_id'
        );

        $this->restoreSlugJsonFromPivot(
            'user_system_accesses',
            'allowed_system_slugs',
            'user_system_access_applications',
            'user_system_access_id'
        );

        $this->restoreEmailJsonFromPivot(
            'applications',
            'private_allowed_user_emails',
            'application_private_access_emails',
            'application_id'
        );

        $this->restoreIdJsonFromPivot(
            'metabase_dashboards',
            'access_group_ids',
            'metabase_dashboard_access_groups',
            'metabase_dashboard_id',
            'access_group_id'
        );

        $this->restoreIdJsonFromPivot(
            'metabase_dashboards',
            'user_ids',
            'metabase_dashboard_users',
            'metabase_dashboard_id',
            'user_id'
        );

        $this->restoreEmailJsonFromPivot(
            'calendar_events',
            'attendee_emails',
            'calendar_event_attendees',
            'calendar_event_id'
        );

        Schema::dropIfExists('calendar_event_attendees');
        Schema::dropIfExists('metabase_dashboard_users');
        Schema::dropIfExists('metabase_dashboard_access_groups');
        Schema::dropIfExists('application_private_access_emails');
        Schema::dropIfExists('user_system_access_applications');
        Schema::dropIfExists('access_group_applications');
    }

    private function migrateSlugJsonColumn(string $table, string $column, callable $migrate): void
    {
        if (! Schema::hasColumn($table, $column)) {
            return;
        }

        DB::table($table)
            ->select(['id', $column])
            ->whereNotNull($column)
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($column, $migrate) {
                foreach ($rows as $row) {
                    $items = $this->decodeJsonArray($row->{$column});
                    if ($items === []) {
                        continue;
                    }

                    $migrate((int) $row->id, $items);
                }
            });
    }

    private function migrateEmailJsonColumn(string $table, string $column, string $targetTable, string $parentColumn): void
    {
        if (! Schema::hasColumn($table, $column)) {
            return;
        }

        DB::table($table)
            ->select(['id', $column])
            ->whereNotNull($column)
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($column, $targetTable, $parentColumn) {
                foreach ($rows as $row) {
                    $emails = collect($this->decodeJsonArray($row->{$column}))
                        ->map(fn ($email) => strtolower(trim((string) $email)))
                        ->filter()
                        ->unique()
                        ->values();

                    foreach ($emails as $email) {
                        DB::table($targetTable)->insert([
                            $parentColumn => (int) $row->id,
                            'email' => mb_substr($email, 0, 255),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    private function migrateIdJsonColumn(
        string $table,
        string $column,
        string $targetTable,
        string $parentColumn,
        string $relatedColumn,
        string $relatedTable
    ): void {
        if (! Schema::hasColumn($table, $column)) {
            return;
        }

        $validIds = DB::table($relatedTable)->pluck('id')->flip();

        DB::table($table)
            ->select(['id', $column])
            ->whereNotNull($column)
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($column, $targetTable, $parentColumn, $relatedColumn, $validIds) {
                foreach ($rows as $row) {
                    $ids = collect($this->decodeJsonArray($row->{$column}))
                        ->map(fn ($id) => (int) $id)
                        ->filter(fn ($id) => $id > 0 && $validIds->has($id))
                        ->unique()
                        ->values();

                    foreach ($ids as $relatedId) {
                        DB::table($targetTable)->insert([
                            $parentColumn => (int) $row->id,
                            $relatedColumn => $relatedId,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    /**
     * @param  \Illuminate\Support\Collection<string, int|string>  $applicationIdsBySlug
     */
    private function insertApplicationSlugs(
        string $table,
        string $parentColumn,
        int $parentId,
        array $slugs,
        $applicationIdsBySlug
    ): void {
        $seen = [];

        foreach ($slugs as $slug) {
            $slug = trim((string) $slug);
            if ($slug === '' || isset($seen[$slug])) {
                continue;
            }

            $applicationId = $applicationIdsBySlug->get($slug);
            if (! $applicationId) {
                continue;
            }

            $seen[$slug] = true;

            DB::table($table)->insert([
                $parentColumn => $parentId,
                'application_id' => (int) $applicationId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * @return array<int, mixed>
     */
    private function decodeJsonArray(mixed $raw): array
    {
        if (is_array($raw)) {
            return $raw;
        }

        if (! is_string($raw) || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function restoreSlugJsonFromPivot(string $table, string $column, string $pivotTable, string $parentColumn): void
    {
        $applicationSlugsById = DB::table('applications')->pluck('slug', 'id');

        $parents = DB::table($table)->pluck('id');
        foreach ($parents as $parentId) {
            $slugs = DB::table($pivotTable)
                ->where($parentColumn, $parentId)
                ->pluck('application_id')
                ->map(fn ($applicationId) => $applicationSlugsById->get($applicationId))
                ->filter()
                ->values()
                ->all();

            DB::table($table)->where('id', $parentId)->update([
                $column => $slugs === [] ? null : json_encode($slugs),
            ]);
        }
    }

    private function restoreEmailJsonFromPivot(string $table, string $column, string $pivotTable, string $parentColumn): void
    {
        $parents = DB::table($table)->pluck('id');
        foreach ($parents as $parentId) {
            $emails = DB::table($pivotTable)
                ->where($parentColumn, $parentId)
                ->orderBy('id')
                ->pluck('email')
                ->values()
                ->all();

            DB::table($table)->where('id', $parentId)->update([
                $column => $emails === [] ? null : json_encode($emails),
            ]);
        }
    }

    private function restoreIdJsonFromPivot(
        string $table,
        string $column,
        string $pivotTable,
        string $parentColumn,
        string $relatedColumn
    ): void {
        $parents = DB::table($table)->pluck('id');
        foreach ($parents as $parentId) {
            $ids = DB::table($pivotTable)
                ->where($parentColumn, $parentId)
                ->orderBy('id')
                ->pluck($relatedColumn)
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all();

            DB::table($table)->where('id', $parentId)->update([
                $column => $ids === [] ? null : json_encode($ids),
            ]);
        }
    }
};
