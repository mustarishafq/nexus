<?php

namespace Tests;

use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function tearDown(): void
    {
        McpUserAccess::resetOverrideCache();

        parent::tearDown();
    }
}
