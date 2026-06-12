<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'department')) {
            $names = DB::table('users')
                ->whereNotNull('department')
                ->where('department', '!=', '')
                ->distinct()
                ->pluck('department');

            foreach ($names as $name) {
                DB::table('departments')->insertOrIgnore([
                    'name' => $name,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'department_id')) {
                $table->foreignId('department_id')
                    ->nullable()
                    ->after('bio')
                    ->constrained()
                    ->nullOnDelete();
            }
        });

        if (Schema::hasColumn('users', 'department')) {
            $departmentMap = DB::table('departments')->pluck('id', 'name');

            foreach ($departmentMap as $name => $id) {
                DB::table('users')
                    ->where('department', $name)
                    ->update(['department_id' => $id]);
            }

            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('department');
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'department')) {
                $table->string('department', 100)->nullable()->after('bio');
            }
        });

        $departmentMap = DB::table('departments')->pluck('name', 'id');

        foreach ($departmentMap as $id => $name) {
            DB::table('users')
                ->where('department_id', $id)
                ->update(['department' => $name]);
        }

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'department_id')) {
                $table->dropConstrainedForeignId('department_id');
            }
        });
    }
};
