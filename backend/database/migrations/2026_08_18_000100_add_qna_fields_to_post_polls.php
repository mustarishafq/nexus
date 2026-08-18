<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_polls', function (Blueprint $table) {
            if (! Schema::hasColumn('post_polls', 'is_qna')) {
                $table->boolean('is_qna')->default(false)->after('allow_add_options');
            }
            if (! Schema::hasColumn('post_polls', 'correct_option_id')) {
                $table->foreignId('correct_option_id')
                    ->nullable()
                    ->after('is_qna')
                    ->constrained('post_poll_options')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('post_polls', function (Blueprint $table) {
            if (Schema::hasColumn('post_polls', 'correct_option_id')) {
                $table->dropConstrainedForeignId('correct_option_id');
            }
            if (Schema::hasColumn('post_polls', 'is_qna')) {
                $table->dropColumn('is_qna');
            }
        });
    }
};
