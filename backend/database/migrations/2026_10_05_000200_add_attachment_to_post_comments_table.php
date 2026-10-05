<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_comments', function (Blueprint $table) {
            // One optional photo (uploaded to comment-images) or GIPHY GIF per comment.
            $table->string('attachment_type', 16)->nullable()->after('body');
            $table->string('attachment_url', 2048)->nullable()->after('attachment_type');
            $table->unsignedInteger('attachment_width')->nullable()->after('attachment_url');
            $table->unsignedInteger('attachment_height')->nullable()->after('attachment_width');
        });

        // Photo/GIF-only comments have no text.
        Schema::table('post_comments', function (Blueprint $table) {
            $table->text('body')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('post_comments', function (Blueprint $table) {
            $table->dropColumn(['attachment_type', 'attachment_url', 'attachment_width', 'attachment_height']);
        });
    }
};
