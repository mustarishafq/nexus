<?php

namespace Tests\Unit;

use App\Support\HealthStatus;
use App\Support\IcNumber;
use Tests\TestCase;

class HrProfileHelpersTest extends TestCase
{
    public function test_ic_number_parses_date_of_birth_for_1900s_and_2000s(): void
    {
        $this->assertSame('1990-01-01', IcNumber::dateOfBirth('900101-01-1234'));
        $this->assertSame('2016-03-15', IcNumber::dateOfBirth('160315145678'));
        $this->assertNull(IcNumber::dateOfBirth('991332-01-1234'));
        $this->assertNull(IcNumber::dateOfBirth('90'));
    }

    public function test_ic_number_fills_date_of_birth_only_when_empty(): void
    {
        $this->assertSame('1990-01-01', IcNumber::fillDateOfBirth(null, '900101-01-1234'));
        $this->assertSame('1988-05-20', IcNumber::fillDateOfBirth('1988-05-20', '900101-01-1234'));
    }

    public function test_health_status_none_cannot_mix_with_other_conditions(): void
    {
        $this->assertNotNull(HealthStatus::validationError([
            'conditions' => ['none', 'migraine'],
            'others' => '',
        ]));

        $this->assertNull(HealthStatus::validationError([
            'conditions' => ['none'],
            'others' => '',
        ]));
    }

    public function test_health_status_others_requires_text(): void
    {
        $this->assertNotNull(HealthStatus::validationError([
            'conditions' => ['others'],
            'others' => '',
        ]));

        $this->assertTrue(HealthStatus::isComplete([
            'conditions' => ['others'],
            'others' => 'Asthma',
        ]));
    }

    public function test_health_status_is_complete_for_none_or_named_conditions(): void
    {
        $this->assertFalse(HealthStatus::isComplete(null));
        $this->assertTrue(HealthStatus::isComplete(['conditions' => ['none']]));
        $this->assertTrue(HealthStatus::isComplete([
            'conditions' => ['high_blood_pressure', 'gerd'],
        ]));
    }
}
