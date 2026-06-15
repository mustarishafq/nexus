<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->string('audience_type', 20)->default('all')->after('priority');
            $table->index('audience_type');
        });

        Schema::create('broadcast_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broadcast_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['broadcast_id', 'user_id']);
        });

        Schema::create('broadcast_departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broadcast_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['broadcast_id', 'department_id']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('broadcast_id')->nullable()->after('is_broadcast')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('broadcast_id');
        });

        Schema::dropIfExists('broadcast_departments');
        Schema::dropIfExists('broadcast_users');

        Schema::table('broadcasts', function (Blueprint $table) {
            $table->dropIndex(['audience_type']);
            $table->dropColumn('audience_type');
        });
    }
};
