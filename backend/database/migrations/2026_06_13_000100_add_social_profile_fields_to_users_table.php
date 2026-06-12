<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('bio')->nullable()->after('cover_picture');
            $table->string('department', 100)->nullable()->after('bio');
            $table->string('location', 100)->nullable()->after('department');
            $table->json('skills')->nullable()->after('location');
            $table->string('ask_me_about', 200)->nullable()->after('skills');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['bio', 'department', 'location', 'skills', 'ask_me_about']);
        });
    }
};
