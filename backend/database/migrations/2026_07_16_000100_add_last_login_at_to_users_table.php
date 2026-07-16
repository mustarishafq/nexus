<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_login_at')->nullable()->after('last_profile_nudge_at');
        });

        if (! Schema::hasTable('activity_logs')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            $rows = DB::table('activity_logs')
                ->select('user_id', DB::raw('MAX(created_at) as last_login_at'))
                ->where('action', 'login')
                ->whereNotNull('user_id')
                ->groupBy('user_id')
                ->get();

            foreach ($rows as $row) {
                DB::table('users')
                    ->where('id', $row->user_id)
                    ->update(['last_login_at' => $row->last_login_at]);
            }

            return;
        }

        DB::statement('
            UPDATE users
            INNER JOIN (
                SELECT user_id, MAX(created_at) AS last_login_at
                FROM activity_logs
                WHERE action = ?
                AND user_id IS NOT NULL
                GROUP BY user_id
            ) AS last_logins ON users.id = last_logins.user_id
            SET users.last_login_at = last_logins.last_login_at
        ', ['login']);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_login_at');
        });
    }
};
