<?php

namespace Tests\Concerns;

trait GrantsUserRoleQuizPlayAccess
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->grantUserRoleQuizPlayAccess();
    }
}
