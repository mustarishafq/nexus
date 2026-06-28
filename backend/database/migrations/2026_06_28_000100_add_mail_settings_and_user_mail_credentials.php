<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('app_settings', 'imap_host')) {
                $table->string('imap_host')->nullable()->after('smtp_from_name');
            }
            if (! Schema::hasColumn('app_settings', 'imap_port')) {
                $table->unsignedInteger('imap_port')->nullable()->after('imap_host');
            }
            if (! Schema::hasColumn('app_settings', 'imap_encryption')) {
                $table->string('imap_encryption', 16)->nullable()->after('imap_port');
            }
        });

        Schema::create('user_mail_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('password');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_mail_credentials');

        Schema::table('app_settings', function (Blueprint $table) {
            if (Schema::hasColumn('app_settings', 'imap_encryption')) {
                $table->dropColumn('imap_encryption');
            }
            if (Schema::hasColumn('app_settings', 'imap_port')) {
                $table->dropColumn('imap_port');
            }
            if (Schema::hasColumn('app_settings', 'imap_host')) {
                $table->dropColumn('imap_host');
            }
        });
    }
};
