<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_mail_credentials', function (Blueprint $table) {
            if (! Schema::hasColumn('user_mail_credentials', 'email')) {
                $table->string('email')->nullable()->after('user_id');
            }
            if (! Schema::hasColumn('user_mail_credentials', 'label')) {
                $table->string('label')->nullable()->after('email');
            }
            if (! Schema::hasColumn('user_mail_credentials', 'is_primary')) {
                $table->boolean('is_primary')->default(false)->after('label');
            }
        });

        $rows = DB::table('user_mail_credentials')
            ->where(function ($query) {
                $query->whereNull('email')->orWhere('email', '');
            })
            ->get(['id', 'user_id']);

        foreach ($rows as $row) {
            $email = DB::table('users')->where('id', $row->user_id)->value('email');

            DB::table('user_mail_credentials')->where('id', $row->id)->update([
                'email' => $email ?: 'unknown@localhost',
                'is_primary' => true,
            ]);
        }

        $userIds = DB::table('user_mail_credentials')->distinct()->pluck('user_id');
        foreach ($userIds as $userId) {
            $hasPrimary = DB::table('user_mail_credentials')
                ->where('user_id', $userId)
                ->where('is_primary', true)
                ->exists();

            if (! $hasPrimary) {
                $firstId = DB::table('user_mail_credentials')
                    ->where('user_id', $userId)
                    ->orderBy('id')
                    ->value('id');

                if ($firstId) {
                    DB::table('user_mail_credentials')->where('id', $firstId)->update(['is_primary' => true]);
                }
            }
        }

        $this->dropUniqueIfExists('user_mail_credentials', 'user_mail_credentials_user_id_unique');

        Schema::table('user_mail_credentials', function (Blueprint $table) {
            $table->unique(['user_id', 'email']);
        });
    }

    public function down(): void
    {
        $this->dropUniqueIfExists('user_mail_credentials', 'user_mail_credentials_user_id_email_unique');

        Schema::table('user_mail_credentials', function (Blueprint $table) {
            $table->unique('user_id');
        });

        Schema::table('user_mail_credentials', function (Blueprint $table) {
            if (Schema::hasColumn('user_mail_credentials', 'is_primary')) {
                $table->dropColumn('is_primary');
            }
            if (Schema::hasColumn('user_mail_credentials', 'label')) {
                $table->dropColumn('label');
            }
            if (Schema::hasColumn('user_mail_credentials', 'email')) {
                $table->dropColumn('email');
            }
        });
    }

    protected function dropUniqueIfExists(string $table, string $indexName): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            $database = Schema::getConnection()->getDatabaseName();
            $exists = DB::table('information_schema.statistics')
                ->where('table_schema', $database)
                ->where('table_name', $table)
                ->where('index_name', $indexName)
                ->exists();

            if ($exists) {
                DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$indexName}`");
            }

            return;
        }

        try {
            Schema::table($table, function (Blueprint $blueprint) use ($indexName) {
                $blueprint->dropUnique($indexName);
            });
        } catch (\Throwable) {
            // Index may already be absent.
        }
    }
};
