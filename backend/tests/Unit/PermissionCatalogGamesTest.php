<?php

namespace Tests\Unit;

use App\Support\PermissionCatalog;
use PHPUnit\Framework\TestCase;

class PermissionCatalogGamesTest extends TestCase
{
    public function test_catalog_includes_quiz_view_and_keeps_manage_own_internally(): void
    {
        $keys = array_column(PermissionCatalog::definitions(), 'key');
        $byKey = array_column(PermissionCatalog::definitions(), null, 'key');

        $this->assertContains(PermissionCatalog::QUIZ_VIEW, $keys);
        $this->assertContains(PermissionCatalog::QUIZ_MANAGE_OWN, $keys);
        $this->assertSame('games', $byKey[PermissionCatalog::QUIZ_VIEW]['module']);
        $this->assertSame('View & Play Games', $byKey[PermissionCatalog::QUIZ_VIEW]['name']);
        $this->assertSame([PermissionCatalog::QUIZ_MANAGE_OWN], PermissionCatalog::hiddenKeys());
        $this->assertNotContains(PermissionCatalog::QUIZ_VIEW, PermissionCatalog::adminOnlyKeys());
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE_OWN, PermissionCatalog::adminOnlyKeys());
    }

    public function test_expand_implied_keys_for_visible_games_checkboxes(): void
    {
        $this->assertEqualsCanonicalizing(
            [PermissionCatalog::QUIZ_VIEW],
            PermissionCatalog::expandImpliedKeys([PermissionCatalog::QUIZ_VIEW])
        );

        $this->assertEqualsCanonicalizing(
            [
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_CREATE,
                PermissionCatalog::QUIZ_MANAGE_OWN,
            ],
            PermissionCatalog::expandImpliedKeys([PermissionCatalog::QUIZ_CREATE])
        );

        $this->assertEqualsCanonicalizing(
            [
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_CREATE,
                PermissionCatalog::QUIZ_MANAGE_OWN,
            ],
            PermissionCatalog::expandImpliedKeys([
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_CREATE,
            ])
        );

        $this->assertEqualsCanonicalizing(
            [
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_CREATE,
                PermissionCatalog::QUIZ_MANAGE_OWN,
                PermissionCatalog::QUIZ_MANAGE,
            ],
            PermissionCatalog::expandImpliedKeys([PermissionCatalog::QUIZ_MANAGE])
        );
    }

    public function test_removing_create_drops_manage_own_unless_manage_is_present(): void
    {
        $this->assertEqualsCanonicalizing(
            [PermissionCatalog::QUIZ_VIEW],
            PermissionCatalog::expandImpliedKeys([
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_MANAGE_OWN,
            ])
        );

        $this->assertEqualsCanonicalizing(
            [
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_CREATE,
                PermissionCatalog::QUIZ_MANAGE_OWN,
                PermissionCatalog::QUIZ_MANAGE,
            ],
            PermissionCatalog::expandImpliedKeys([
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_MANAGE,
            ])
        );
    }

    public function test_implied_permissions_survive_exact_visible_sync(): void
    {
        $this->assertContains(
            PermissionCatalog::QUIZ_MANAGE_OWN,
            PermissionCatalog::expandImpliedKeys([
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_CREATE,
            ])
        );
        $this->assertContains(
            PermissionCatalog::QUIZ_MANAGE_OWN,
            PermissionCatalog::expandImpliedKeys([
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_CREATE,
                PermissionCatalog::QUIZ_MANAGE,
            ])
        );
    }
}
