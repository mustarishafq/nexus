<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (! Schema::hasColumn('posts', 'image_urls')) {
                $table->json('image_urls')->nullable()->after('image_url');
            }
        });

        if (Schema::hasColumn('posts', 'image_url') && Schema::hasColumn('posts', 'image_urls')) {
            DB::table('posts')
                ->whereNotNull('image_url')
                ->where('image_url', '!=', '')
                ->orderBy('id')
                ->chunkById(100, function ($posts) {
                    foreach ($posts as $post) {
                        DB::table('posts')->where('id', $post->id)->update([
                            'image_urls' => json_encode([trim((string) $post->image_url)]),
                        ]);
                    }
                });
        }
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (Schema::hasColumn('posts', 'image_urls')) {
                $table->dropColumn('image_urls');
            }
        });
    }
};
