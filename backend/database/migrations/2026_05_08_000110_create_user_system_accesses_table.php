<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_system_accesses', function (Blueprint $table) {
            $table->id();
            $table->string('user_email')->unique();
            $table->json('allowed_system_slugs')->nullable();
            $table->timestamps();

            $table->index('user_email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_system_accesses');
    }
};
