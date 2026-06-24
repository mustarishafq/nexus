<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE notifications MODIFY COLUMN category ENUM('booking', 'hr', 'inventory', 'finance', 'security', 'system', 'task', 'approval', 'announcement', 'calendar', 'other') DEFAULT 'other'");
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE notifications MODIFY COLUMN category ENUM('booking', 'hr', 'inventory', 'finance', 'security', 'system', 'task', 'approval', 'announcement', 'other') DEFAULT 'other'");
    }
};
