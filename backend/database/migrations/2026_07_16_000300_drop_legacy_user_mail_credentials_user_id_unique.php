<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_mail_credentials')) {
            return;
        }

        $this->dropIndexIfExists('user_mail_credentials', 'user_mail_credentials_user_id_unique');
    }

    public function down(): void
    {
        if (! Schema::hasTable('user_mail_credentials')) {
            return;
        }

        // Only restore the legacy single-account constraint when each user has at most one row.
        $hasDuplicates = DB::table('user_mail_credentials')
            ->select('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 1')
            ->exists();

        if ($hasDuplicates || $this->indexExists('user_mail_credentials', 'user_mail_credentials_user_id_unique')) {
            return;
        }

        Schema::table('user_mail_credentials', function ($table) {
            $table->unique('user_id');
        });
    }

    protected function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! $this->indexExists($table, $indexName)) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            // SQLite cannot DROP INDEX IF EXISTS by table-scoped name the same way;
            // Laravel's blueprint handles the rebuild.
            Schema::table($table, function ($blueprint) use ($indexName) {
                $blueprint->dropUnique($indexName);
            });

            return;
        }

        DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$indexName}`");
    }

    protected function indexExists(string $table, string $indexName): bool
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            $indexes = DB::select("PRAGMA index_list('{$table}')");

            return collect($indexes)->contains(fn ($index) => ($index->name ?? null) === $indexName);
        }

        $database = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();
    }
};
