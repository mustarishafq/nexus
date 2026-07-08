<?php

namespace App\Providers;

use App\Support\AppSettings;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
            $email = method_exists($notifiable, 'getEmailForPasswordReset')
                ? $notifiable->getEmailForPasswordReset()
                : $notifiable->email;

            return $frontendUrl.'/reset-password?'.http_build_query([
                'token' => $token,
                'email' => $email,
            ]);
        });

        RateLimiter::for('mail-imap', function () {
            return Limit::perMinute(40);
        });

        try {
            $settings = AppSettings::row();

            if (! $settings) {
                return;
            }
            $systemName = $settings?->system_name ?: config('app.name', 'EMZI Nexus Brain');

            Config::set('app.name', $systemName);

            if (! empty($settings?->smtp_host)) {
                Config::set('mail.default', 'smtp');
                Config::set('mail.mailers.smtp.host', $settings->smtp_host);
                Config::set('mail.mailers.smtp.port', (int) ($settings->smtp_port ?: 587));
                Config::set('mail.mailers.smtp.username', $settings->smtp_username);
                Config::set('mail.mailers.smtp.password', $settings->smtp_password);
                Config::set('mail.mailers.smtp.scheme', AppSettings::smtpSchemeFromEncryption($settings->smtp_encryption));
            }

            if (! empty($settings?->smtp_from_email)) {
                Config::set('mail.from.address', $settings->smtp_from_email);
            }

            Config::set('mail.from.name', $settings?->smtp_from_name ?: $systemName);
        } catch (Throwable) {
            // Keep booting with environment defaults when the settings table is unavailable.
        }
    }
}
