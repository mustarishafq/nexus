<?php

namespace App\Support;

class PermissionCatalog
{
    public const QUIZ_VIEW = 'quiz.view';

    public const QUIZ_CREATE = 'quiz.create';

    public const QUIZ_MANAGE_OWN = 'quiz.manage_own';

    public const QUIZ_MANAGE = 'quiz.manage';

    public const PEOPLE_VIEW_SENSITIVE = 'people.view_sensitive';

    public const PEOPLE_MANAGE_USERS = 'people.manage_users';

    public const PEOPLE_ASSIGN_ROLE = 'people.assign_role';

    public const PEOPLE_IMPERSONATE = 'people.impersonate';

    public const PEOPLE_MANAGE_GROUPS = 'people.manage_groups';

    public const FEED_MODERATE = 'feed.moderate';

    public const ATTENDANCE_VIEW_ALL = 'attendance.view_all';

    public const ATTENDANCE_MANAGE_POLICY = 'attendance.manage_policy';

    public const GAMIFICATION_AWARD_MANUAL = 'gamification.award_manual';

    public const CALENDAR_VIEW_ALL = 'calendar.view_all';

    public const CALENDAR_MANAGE = 'calendar.manage';

    public const ANALYTICS_MANAGE = 'analytics.manage';

    public const APPLICATIONS_MANAGE = 'applications.manage';

    public const BROADCAST_MANAGE = 'broadcast.manage';

    public const NETWORK_VIEW = 'network.view';

    public const NETWORK_VIEW_ALL = 'network.view_all';

    public const SETTINGS_MANAGE = 'settings.manage';

    public const ROLES_MANAGE = 'roles.manage';

    public const TOKENS_MANAGE = 'tokens.manage';

    /**
     * @return list<array{key: string, module: string, name: string, sort_order: int}>
     */
    public static function definitions(): array
    {
        return [
            ['key' => self::QUIZ_VIEW, 'module' => 'games', 'name' => 'View & Play Games', 'sort_order' => 5],
            ['key' => self::QUIZ_CREATE, 'module' => 'games', 'name' => 'Create Games', 'sort_order' => 10],
            ['key' => self::QUIZ_MANAGE_OWN, 'module' => 'games', 'name' => 'Manage own games', 'sort_order' => 20],
            ['key' => self::QUIZ_MANAGE, 'module' => 'games', 'name' => 'Manage All Games', 'sort_order' => 30],

            ['key' => self::CALENDAR_VIEW_ALL, 'module' => 'calendar', 'name' => 'View all calendar events', 'sort_order' => 10],
            ['key' => self::CALENDAR_MANAGE, 'module' => 'calendar', 'name' => 'Manage all calendar events', 'sort_order' => 20],

            ['key' => self::PEOPLE_VIEW_SENSITIVE, 'module' => 'people', 'name' => 'View sensitive people information', 'sort_order' => 10],
            ['key' => self::PEOPLE_MANAGE_USERS, 'module' => 'people', 'name' => 'Manage users', 'sort_order' => 20],
            ['key' => self::PEOPLE_ASSIGN_ROLE, 'module' => 'people', 'name' => 'Assign roles', 'sort_order' => 30],
            ['key' => self::PEOPLE_IMPERSONATE, 'module' => 'people', 'name' => 'Impersonate users', 'sort_order' => 40],
            ['key' => self::PEOPLE_MANAGE_GROUPS, 'module' => 'people', 'name' => 'Manage access groups', 'sort_order' => 50],

            ['key' => self::FEED_MODERATE, 'module' => 'feed', 'name' => 'Moderate feed', 'sort_order' => 10],

            ['key' => self::ATTENDANCE_VIEW_ALL, 'module' => 'attendance', 'name' => 'View all attendance', 'sort_order' => 10],
            ['key' => self::ATTENDANCE_MANAGE_POLICY, 'module' => 'attendance', 'name' => 'Manage attendance policy', 'sort_order' => 20],

            ['key' => self::GAMIFICATION_AWARD_MANUAL, 'module' => 'gamification', 'name' => 'Award EXP manually', 'sort_order' => 10],

            ['key' => self::ANALYTICS_MANAGE, 'module' => 'analytics', 'name' => 'Manage company dashboards', 'sort_order' => 10],

            ['key' => self::APPLICATIONS_MANAGE, 'module' => 'applications', 'name' => 'Manage application catalog', 'sort_order' => 10],

            ['key' => self::BROADCAST_MANAGE, 'module' => 'broadcast', 'name' => 'Send broadcasts', 'sort_order' => 10],

            ['key' => self::NETWORK_VIEW, 'module' => 'network', 'name' => 'View network page', 'sort_order' => 10],
            ['key' => self::NETWORK_VIEW_ALL, 'module' => 'network', 'name' => 'View all network health', 'sort_order' => 20],

            ['key' => self::SETTINGS_MANAGE, 'module' => 'admin', 'name' => 'Manage settings', 'sort_order' => 10],
            ['key' => self::ROLES_MANAGE, 'module' => 'admin', 'name' => 'Manage roles', 'sort_order' => 20],
            ['key' => self::TOKENS_MANAGE, 'module' => 'admin', 'name' => 'Manage API tokens / SSO', 'sort_order' => 30],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function moduleLabels(): array
    {
        return [
            'games' => 'Games',
            'calendar' => 'Calendar',
            'people' => 'People',
            'feed' => 'Feed',
            'attendance' => 'Attendance',
            'gamification' => 'Gamification',
            'analytics' => 'Analytics',
            'applications' => 'Applications',
            'broadcast' => 'Broadcast',
            'network' => 'Network',
        ];
    }

    /**
     * Display order for the Roles permission UI.
     *
     * @return list<string>
     */
    public static function moduleOrder(): array
    {
        return array_keys(self::moduleLabels());
    }

    /**
     * Admin-only capabilities that stay on the Admin role and are not shown in the Roles UI.
     *
     * @return list<string>
     */
    public static function adminOnlyKeys(): array
    {
        return [
            self::SETTINGS_MANAGE,
            self::ROLES_MANAGE,
            self::TOKENS_MANAGE,
        ];
    }

    /**
     * Stored on roles but not shown in the Roles UI.
     * Unlike admin-only keys, these are not stripped from non-Admin saves.
     *
     * @return list<string>
     */
    public static function hiddenKeys(): array
    {
        return [
            self::QUIZ_MANAGE_OWN,
        ];
    }

    /**
     * Expand visible Games checkboxes into the stored permission set.
     *
     * @param  list<string>  $keys
     * @return list<string>
     */
    public static function expandImpliedKeys(array $keys): array
    {
        $keys = array_values(array_unique($keys));
        $hasView = in_array(self::QUIZ_VIEW, $keys, true);
        $hasCreate = in_array(self::QUIZ_CREATE, $keys, true);
        $hasManage = in_array(self::QUIZ_MANAGE, $keys, true);

        if ($hasManage) {
            $keys[] = self::QUIZ_VIEW;
            $keys[] = self::QUIZ_CREATE;
            $keys[] = self::QUIZ_MANAGE_OWN;
            $keys[] = self::QUIZ_MANAGE;
        } elseif ($hasCreate) {
            $keys[] = self::QUIZ_VIEW;
            $keys[] = self::QUIZ_CREATE;
            $keys[] = self::QUIZ_MANAGE_OWN;
        } else {
            $keys = array_values(array_diff($keys, [
                self::QUIZ_CREATE,
                self::QUIZ_MANAGE_OWN,
                self::QUIZ_MANAGE,
            ]));
            if ($hasView) {
                $keys[] = self::QUIZ_VIEW;
            }
        }

        return array_values(array_unique($keys));
    }

    /**
     * Seeded permission keys that reproduce today's Admin / HR / User behaviour.
     *
     * @return array<string, list<string>>
     */
    public static function seedKeysByRoleSlug(): array
    {
        $all = array_column(self::definitions(), 'key');

        return [
            UserRoles::ADMIN => $all,
            UserRoles::HR => [
                self::QUIZ_VIEW,
                self::QUIZ_CREATE,
                self::QUIZ_MANAGE_OWN,
                self::PEOPLE_VIEW_SENSITIVE,
                self::PEOPLE_MANAGE_USERS,
                self::FEED_MODERATE,
                self::ATTENDANCE_VIEW_ALL,
                self::ATTENDANCE_MANAGE_POLICY,
                self::GAMIFICATION_AWARD_MANUAL,
                self::NETWORK_VIEW,
            ],
            UserRoles::USER => [
                self::NETWORK_VIEW,
            ],
        ];
    }
}
