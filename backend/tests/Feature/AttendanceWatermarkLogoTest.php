<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AttendanceWatermarkLogoTest extends TestCase
{
    public function test_rejects_invalid_logo_paths(): void
    {
        $response = $this->getJson('/api/attendance/watermark-logo?'.http_build_query([
            'path' => '/storage/../etc/passwd',
        ]));

        $response->assertStatus(422);
    }

    public function test_returns_logo_file_from_public_storage(): void
    {
        Storage::fake('public');

        $relative = 'attendance-watermark-logos/test-logo.png';
        Storage::disk('public')->put(
            $relative,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
        );

        $response = $this->get('/api/attendance/watermark-logo?'.http_build_query([
            'path' => '/storage/'.$relative,
        ]));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'image/png');
        $this->assertNotSame('', $response->getContent());
    }

    public function test_returns_not_found_when_logo_is_missing(): void
    {
        Storage::fake('public');

        $response = $this->getJson('/api/attendance/watermark-logo?'.http_build_query([
            'path' => '/storage/attendance-watermark-logos/missing.jpg',
        ]));

        $response->assertNotFound();
    }
}
