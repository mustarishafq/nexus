<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('job_title', 150)->nullable()->after('department_id');
            $table->string('work_phone', 30)->nullable()->after('job_title');
            $table->string('personal_phone', 30)->nullable()->after('work_phone');
            $table->boolean('personal_phone_visible')->default(false)->after('personal_phone');
            $table->foreignId('manager_id')->nullable()->after('personal_phone_visible')->constrained('users')->nullOnDelete();
            $table->string('employee_id', 50)->nullable()->after('manager_id');
            $table->string('employment_type', 30)->nullable()->after('employee_id');
            $table->string('emergency_contact_name', 150)->nullable()->after('employment_type');
            $table->string('emergency_contact_phone', 30)->nullable()->after('emergency_contact_name');
            $table->string('gender', 30)->nullable()->after('emergency_contact_phone');
            $table->json('education_history')->nullable()->after('gender');
            $table->json('work_history')->nullable()->after('education_history');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['manager_id']);
            $table->dropColumn([
                'job_title',
                'work_phone',
                'personal_phone',
                'personal_phone_visible',
                'manager_id',
                'employee_id',
                'employment_type',
                'emergency_contact_name',
                'emergency_contact_phone',
                'gender',
                'education_history',
                'work_history',
            ]);
        });
    }
};
