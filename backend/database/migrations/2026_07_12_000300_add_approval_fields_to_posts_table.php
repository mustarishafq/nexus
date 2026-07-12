<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (! Schema::hasColumn('posts', 'approval_status')) {
                $table->string('approval_status', 16)->default('approved')->after('image_url');
            }
            if (! Schema::hasColumn('posts', 'approved_by_user_id')) {
                $table->foreignId('approved_by_user_id')
                    ->nullable()
                    ->after('approval_status')
                    ->constrained('users')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('posts', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approved_by_user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (Schema::hasColumn('posts', 'approved_by_user_id')) {
                $table->dropConstrainedForeignId('approved_by_user_id');
            }
            $columns = array_values(array_filter([
                Schema::hasColumn('posts', 'approval_status') ? 'approval_status' : null,
                Schema::hasColumn('posts', 'approved_at') ? 'approved_at' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
