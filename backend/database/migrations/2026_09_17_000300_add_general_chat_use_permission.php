<?php

use Database\Seeders\RbacSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        (new RbacSeeder)->run();
    }

    public function down(): void
    {
        // Permission catalog expansion is additive.
    }
};
