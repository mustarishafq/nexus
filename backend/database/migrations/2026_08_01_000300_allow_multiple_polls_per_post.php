<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_polls', function (Blueprint $table) {
            if (! Schema::hasColumn('post_polls', 'sort_order')) {
                $table->unsignedTinyInteger('sort_order')->default(0)->after('post_id');
            }
        });

        $indexNames = collect(Schema::getIndexes('post_polls'))->pluck('name')->all();

        if (in_array('post_polls_post_id_unique', $indexNames, true)) {
            // MySQL may use the unique index for the post_id FK — add a plain index first.
            if (! in_array('post_polls_post_id_index', $indexNames, true)) {
                Schema::table('post_polls', function (Blueprint $table) {
                    $table->index('post_id', 'post_polls_post_id_index');
                });
            }

            Schema::table('post_polls', function (Blueprint $table) {
                $table->dropUnique('post_polls_post_id_unique');
            });
        }

        // Backfill sort_order for existing rows.
        $posts = DB::table('post_polls')->select('post_id')->distinct()->pluck('post_id');
        foreach ($posts as $postId) {
            $polls = DB::table('post_polls')->where('post_id', $postId)->orderBy('id')->get();
            foreach ($polls as $index => $poll) {
                DB::table('post_polls')->where('id', $poll->id)->update(['sort_order' => $index]);
            }
        }
    }

    public function down(): void
    {
        // Keep only the earliest poll per post before restoring uniqueness.
        $duplicates = DB::table('post_polls')
            ->select('post_id')
            ->groupBy('post_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('post_id');

        foreach ($duplicates as $postId) {
            $keepId = DB::table('post_polls')->where('post_id', $postId)->orderBy('id')->value('id');
            DB::table('post_polls')->where('post_id', $postId)->where('id', '!=', $keepId)->delete();
        }

        $indexNames = collect(Schema::getIndexes('post_polls'))->pluck('name')->all();

        Schema::table('post_polls', function (Blueprint $table) use ($indexNames) {
            if (! in_array('post_polls_post_id_unique', $indexNames, true)) {
                $table->unique('post_id');
            }
            if (in_array('post_polls_post_id_index', $indexNames, true)) {
                $table->dropIndex('post_polls_post_id_index');
            }
            if (Schema::hasColumn('post_polls', 'sort_order')) {
                $table->dropColumn('sort_order');
            }
        });
    }
};
