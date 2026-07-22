<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (! Schema::hasColumn('posts', 'edited_at')) {
                $table->timestamp('edited_at')->nullable()->after('approved_at');
            }
        });

        Schema::create('post_edits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('posts')->cascadeOnDelete();
            $table->foreignId('editor_user_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index(['post_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_edits');

        Schema::table('posts', function (Blueprint $table) {
            if (Schema::hasColumn('posts', 'edited_at')) {
                $table->dropColumn('edited_at');
            }
        });
    }
};
