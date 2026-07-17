<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->uuid('check_in_token')->nullable()->unique()->after('created_by');
        });

        DB::table('calendar_events')
            ->whereNull('check_in_token')
            ->orderBy('id')
            ->chunkById(100, function ($events) {
                foreach ($events as $event) {
                    DB::table('calendar_events')
                        ->where('id', $event->id)
                        ->update(['check_in_token' => (string) Str::uuid()]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropUnique(['check_in_token']);
            $table->dropColumn('check_in_token');
        });
    }
};
