<?php

namespace Tests\Unit;

use App\Support\GeneralChatSettings;
use Carbon\Carbon;
use Tests\TestCase;

class GeneralChatSettingsTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_daily_window_uses_reset_time(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-17 08:00:00', 'Asia/Kuala_Lumpur'));
        $settings = (object) [
            'general_chat_reset_period' => 'daily',
            'general_chat_reset_time' => '09:00',
            'general_chat_token_limit' => 1000,
        ];

        [$start, $end] = GeneralChatSettings::currentWindow(null, $settings);

        $this->assertSame('2026-09-16 09:00:00', $start->timezone('Asia/Kuala_Lumpur')->format('Y-m-d H:i:s'));
        $this->assertSame('2026-09-17 09:00:00', $end->timezone('Asia/Kuala_Lumpur')->format('Y-m-d H:i:s'));
    }

    public function test_weekly_window_starts_on_configured_weekday(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-17 12:00:00', 'Asia/Kuala_Lumpur'));
        $settings = (object) [
            'general_chat_reset_period' => 'weekly',
            'general_chat_reset_time' => '00:00',
            'general_chat_reset_weekday' => 1,
        ];

        [$start, $end] = GeneralChatSettings::currentWindow(null, $settings);

        $this->assertSame(1, (int) $start->timezone('Asia/Kuala_Lumpur')->isoWeekday());
        $this->assertSame('2026-09-14 00:00:00', $start->timezone('Asia/Kuala_Lumpur')->format('Y-m-d H:i:s'));
        $this->assertSame('2026-09-21 00:00:00', $end->timezone('Asia/Kuala_Lumpur')->format('Y-m-d H:i:s'));
    }

    public function test_monthly_window_rolls_back_before_reset_day(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-17 12:00:00', 'Asia/Kuala_Lumpur'));
        $settings = (object) [
            'general_chat_reset_period' => 'monthly',
            'general_chat_reset_time' => '00:00',
            'general_chat_reset_month_day' => 1,
        ];

        [$start, $end] = GeneralChatSettings::currentWindow(null, $settings);

        $this->assertSame('2026-09-01 00:00:00', $start->timezone('Asia/Kuala_Lumpur')->format('Y-m-d H:i:s'));
        $this->assertSame('2026-10-01 00:00:00', $end->timezone('Asia/Kuala_Lumpur')->format('Y-m-d H:i:s'));
    }
}
