<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class ForgotPasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_password_sends_reset_link_for_existing_user(): void
    {
        Notification::fake();

        $user = User::factory()->create(['is_approved' => true]);

        $this->postJson('/api/auth/forgot-password', [
            'email' => $user->email,
        ])->assertOk()
            ->assertJson([
                'message' => 'Reset link sent if the email exists.',
            ]);

        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_reset_password_updates_user_password(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'force_password_change' => true,
        ]);

        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk()
            ->assertJson([
                'message' => 'Password has been reset.',
            ]);

        $user->refresh();

        $this->assertFalse($user->force_password_change);
        $this->assertTrue(password_verify('new-password-123', $user->password));
    }
}
