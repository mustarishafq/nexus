<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('oauth_auth_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code_hash', 64)->unique();
            $table->string('client_id', 64);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('redirect_uri', 2048);
            $table->string('code_challenge');
            $table->string('code_challenge_method', 16)->default('S256');
            $table->string('scope')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->index(['client_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oauth_auth_codes');
    }
};
