<?php

namespace App\Providers;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
        try {
            if (! Schema::hasTable('app_settings')) {
                return;
            }

            $settings = DB::table('app_settings')->first();
            $systemName = $settings?->system_name ?: config('app.name', 'Nexus');

            Config::set('app.name', $systemName);

            if (! empty($settings?->smtp_host)) {
                Config::set('mail.default', 'smtp');
                Config::set('mail.mailers.smtp.host', $settings->smtp_host);
                Config::set('mail.mailers.smtp.port', (int) ($settings->smtp_port ?: 587));
                Config::set('mail.mailers.smtp.username', $settings->smtp_username);
                Config::set('mail.mailers.smtp.password', $settings->smtp_password);
                Config::set('mail.mailers.smtp.scheme', $settings->smtp_encryption ?: null);
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
