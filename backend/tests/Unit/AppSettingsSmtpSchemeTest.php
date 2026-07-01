<?php

namespace Tests\Unit;

use App\Support\AppSettings;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AppSettingsSmtpSchemeTest extends TestCase
{
    #[DataProvider('smtpSchemeProvider')]
    public function test_smtp_scheme_from_encryption(?string $encryption, ?string $expected): void
    {
        $this->assertSame($expected, AppSettings::smtpSchemeFromEncryption($encryption));
    }

    public static function smtpSchemeProvider(): array
    {
        return [
            'tls uses starttls via default smtp transport' => ['tls', null],
            'ssl uses implicit tls' => ['ssl', 'smtps'],
            'empty uses default smtp transport' => ['', null],
            'null uses default smtp transport' => [null, null],
        ];
    }
}
