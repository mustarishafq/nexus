<?php

namespace Database\Factories;

use App\Models\Application;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Application>
 */
class ApplicationFactory extends Factory
{
    protected $model = Application::class;

    public function definition(): array
    {
        return [
            'name' => fake()->words(2, true),
            'slug' => fake()->unique()->slug(2),
            'description' => fake()->sentence(),
            'base_url' => fake()->url(),
            'status' => 'online',
            'auth_mode' => 'jwt',
            'open_mode' => 'embedded',
            'visibility' => 'public',
            'created_by_user_id' => User::factory(),
            'is_enabled' => true,
            'health_check_enabled' => true,
            'health_check_path' => '/api/health',
            'health_check_mode' => 'json_ok',
            'color' => '#6366f1',
            'sort_order' => 1,
        ];
    }
}
