<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('department_attendance_settings')) {
            return;
        }

        Schema::create('department_attendance_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(true);
            $table->boolean('geofence_enabled')->default(false);
            $table->decimal('center_latitude', 10, 7)->nullable();
            $table->decimal('center_longitude', 10, 7)->nullable();
            $table->unsignedInteger('radius_meters')->default(200);
            $table->boolean('allow_outside_radius')->default(false);
            $table->string('timezone', 64)->default('UTC');
            $table->unsignedSmallInteger('grace_period_minutes')->default(15);
            $table->boolean('allow_outside_shift_hours')->default(false);
            $table->boolean('overtime_enabled')->default(true);
            $table->decimal('standard_hours_per_day', 4, 2)->default(8.00);
            $table->unsignedSmallInteger('overtime_threshold_minutes')->default(0);
            $table->json('shifts')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('department_attendance_settings');
    }
};
