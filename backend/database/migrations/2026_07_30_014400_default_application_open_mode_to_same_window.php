<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Existing apps defaulted to the in-app browser; prefer same-tab navigation.
        DB::table('applications')
            ->where('open_mode', 'embedded')
            ->update(['open_mode' => 'same_window']);

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE applications MODIFY open_mode ENUM('embedded', 'new_tab', 'same_window') NOT NULL DEFAULT 'same_window'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE applications ALTER COLUMN open_mode SET DEFAULT 'same_window'");
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE applications MODIFY open_mode ENUM('embedded', 'new_tab', 'same_window') NOT NULL DEFAULT 'embedded'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE applications ALTER COLUMN open_mode SET DEFAULT 'embedded'");
        }
    }
};
