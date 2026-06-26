<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('oauth_clients', function (Blueprint $table) {
            $table->id();
            $table->string('client_id', 64)->unique();
            $table->string('client_secret_hash', 255)->nullable();
            $table->string('name');
            $table->json('redirect_uris');
            $table->string('token_endpoint_auth_method')->default('none');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oauth_clients');
    }
};
