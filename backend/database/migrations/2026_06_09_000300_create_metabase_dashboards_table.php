<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metabase_dashboards', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('public_url');
            $table->json('access_group_ids')->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('is_enabled');
            $table->index('sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metabase_dashboards');
    }
};
