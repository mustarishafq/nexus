<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auth_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->unique('token_hash');
            $table->index(['user_id', 'expires_at']);
        });

        if (! Schema::hasColumn('users', 'remember_token')) {
            return;
        }

        DB::table('users')
            ->whereNotNull('remember_token')
            ->orderBy('id')
            ->get(['id', 'remember_token'])
            ->each(function ($user) {
                DB::table('auth_tokens')->insert([
                    'user_id' => $user->id,
                    'token_hash' => $user->remember_token,
                    'last_used_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('auth_tokens');
    }
};
