<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('access_group_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('access_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['access_group_id', 'user_id']);
        });

        if (Schema::hasColumn('users', 'access_group_id')) {
            $rows = DB::table('users')
                ->whereNotNull('access_group_id')
                ->get(['id', 'access_group_id']);

            foreach ($rows as $row) {
                DB::table('access_group_user')->insert([
                    'access_group_id' => $row->access_group_id,
                    'user_id' => $row->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            Schema::table('users', function (Blueprint $table) {
                $table->dropConstrainedForeignId('access_group_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('access_group_id')
                ->nullable()
                ->after('role')
                ->constrained('access_groups')
                ->nullOnDelete();
        });

        $pivotRows = DB::table('access_group_user')
            ->select('user_id', DB::raw('MIN(access_group_id) as access_group_id'))
            ->groupBy('user_id')
            ->get();

        foreach ($pivotRows as $row) {
            DB::table('users')
                ->where('id', $row->user_id)
                ->update(['access_group_id' => $row->access_group_id]);
        }

        Schema::dropIfExists('access_group_user');
    }
};
