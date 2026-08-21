<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RbacSeeder::class);

        $adminRoleId = \App\Models\Role::query()->where('slug', 'admin')->value('id');

        User::query()->updateOrCreate(
            ['email' => 'admin@admin.com'],
            [
                'name' => 'Admin',
                'full_name' => 'System Admin',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'role_id' => $adminRoleId,
                'is_approved' => true,
            ]
        );
    }
}
