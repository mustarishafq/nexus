<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (! $this->hasIndex('notifications', 'notifications_user_read_created_idx')) {
                $table->index(['user_id', 'is_read', 'created_at'], 'notifications_user_read_created_idx');
            }
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            if (! $this->hasIndex('activity_logs', 'activity_logs_system_created_idx')) {
                $table->index(['system_id', 'created_at'], 'activity_logs_system_created_idx');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (! $this->hasIndex('users', 'users_approved_dob_idx')) {
                $table->index(['is_approved', 'date_of_birth'], 'users_approved_dob_idx');
            }
            if (! $this->hasIndex('users', 'users_approved_joined_idx')) {
                $table->index(['is_approved', 'joined_at'], 'users_approved_joined_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_user_read_created_idx');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex('activity_logs_system_created_idx');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_approved_dob_idx');
            $table->dropIndex('users_approved_joined_idx');
        });
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $connection = Schema::getConnection();
        $driver = $connection->getDriverName();

        if ($driver === 'sqlite') {
            $indexes = $connection->select("PRAGMA index_list('{$table}')");

            return collect($indexes)->contains(fn ($index) => $index->name === $indexName);
        }

        $database = $connection->getDatabaseName();
        $result = $connection->select(
            'SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$database, $table, $indexName],
        );

        return $result !== [];
    }
};
