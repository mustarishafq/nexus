<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('place_of_birth', 100)->nullable()->after('gender');
            $table->string('nationality', 50)->nullable()->after('place_of_birth');
            $table->string('religion', 50)->nullable()->after('nationality');
            $table->string('race', 50)->nullable()->after('religion');
            $table->string('marital_status', 30)->nullable()->after('race');
            $table->text('current_address')->nullable()->after('marital_status');
            $table->string('home_phone', 30)->nullable()->after('current_address');
            $table->string('ic_number', 20)->nullable()->after('home_phone');
            $table->string('epf_number', 30)->nullable()->after('ic_number');
            $table->string('socso_number', 30)->nullable()->after('epf_number');
            $table->string('income_tax_number', 30)->nullable()->after('socso_number');
            $table->string('next_of_kin_relationship', 50)->nullable()->after('emergency_contact_phone');
            $table->string('next_of_kin_ic_number', 20)->nullable()->after('next_of_kin_relationship');
            $table->string('next_of_kin_nationality', 50)->nullable()->after('next_of_kin_ic_number');
            $table->string('next_of_kin_occupation', 150)->nullable()->after('next_of_kin_nationality');
            $table->text('next_of_kin_address')->nullable()->after('next_of_kin_occupation');
            $table->json('spouse_details')->nullable()->after('next_of_kin_address');
            $table->json('children')->nullable()->after('spouse_details');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'place_of_birth',
                'nationality',
                'religion',
                'race',
                'marital_status',
                'current_address',
                'home_phone',
                'ic_number',
                'epf_number',
                'socso_number',
                'income_tax_number',
                'next_of_kin_relationship',
                'next_of_kin_ic_number',
                'next_of_kin_nationality',
                'next_of_kin_occupation',
                'next_of_kin_address',
                'spouse_details',
                'children',
            ]);
        });
    }
};
