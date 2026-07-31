<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_polls', function (Blueprint $table) {
            if (! Schema::hasColumn('post_polls', 'allow_multiple')) {
                $table->boolean('allow_multiple')->default(false)->after('post_id');
            }
            if (! Schema::hasColumn('post_polls', 'allow_add_options')) {
                $table->boolean('allow_add_options')->default(false)->after('allow_multiple');
            }
        });

        $indexNames = collect(Schema::getIndexes('post_poll_votes'))->pluck('name')->all();

        Schema::table('post_poll_votes', function (Blueprint $table) use ($indexNames) {
            // MySQL FKs on post_poll_id rely on the old composite unique — add a dedicated index first.
            if (! in_array('post_poll_votes_post_poll_id_index', $indexNames, true)) {
                $table->index('post_poll_id', 'post_poll_votes_post_poll_id_index');
            }
        });

        $indexNames = collect(Schema::getIndexes('post_poll_votes'))->pluck('name')->all();

        Schema::table('post_poll_votes', function (Blueprint $table) use ($indexNames) {
            if (in_array('post_poll_votes_post_poll_id_user_id_unique', $indexNames, true)) {
                $table->dropUnique('post_poll_votes_post_poll_id_user_id_unique');
            }

            if (! in_array('post_poll_votes_poll_user_option_unique', $indexNames, true)) {
                $table->unique(
                    ['post_poll_id', 'user_id', 'post_poll_option_id'],
                    'post_poll_votes_poll_user_option_unique'
                );
            }
        });
    }

    public function down(): void
    {
        $indexNames = collect(Schema::getIndexes('post_poll_votes'))->pluck('name')->all();

        Schema::table('post_poll_votes', function (Blueprint $table) use ($indexNames) {
            if (in_array('post_poll_votes_poll_user_option_unique', $indexNames, true)) {
                $table->dropUnique('post_poll_votes_poll_user_option_unique');
            }

            $table->unique(['post_poll_id', 'user_id']);
        });

        $indexNames = collect(Schema::getIndexes('post_poll_votes'))->pluck('name')->all();

        Schema::table('post_poll_votes', function (Blueprint $table) use ($indexNames) {
            if (in_array('post_poll_votes_post_poll_id_index', $indexNames, true)) {
                $table->dropIndex('post_poll_votes_post_poll_id_index');
            }
        });

        Schema::table('post_polls', function (Blueprint $table) {
            if (Schema::hasColumn('post_polls', 'allow_multiple')) {
                $table->dropColumn('allow_multiple');
            }
            if (Schema::hasColumn('post_polls', 'allow_add_options')) {
                $table->dropColumn('allow_add_options');
            }
        });
    }
};
