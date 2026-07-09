<?php

namespace App\Support;

use App\Models\User;

class UserRoles
{
    public const ADMIN = 'admin';

    public const USER = 'user';

    public const HR = 'hr';

    /** @var list<string> */
    public const ALL = [
        self::ADMIN,
        self::USER,
        self::HR,
    ];

    public static function isAdmin(User $user): bool
    {
        return $user->role === self::ADMIN;
    }

    public static function isHr(User $user): bool
    {
        return $user->role === self::HR;
    }

    public static function isHrOrAdmin(User $user): bool
    {
        return self::isAdmin($user) || self::isHr($user);
    }

    /**
     * @param  string|list<string>  $roles
     */
    public static function hasRole(User $user, string|array $roles): bool
    {
        $roles = is_array($roles) ? $roles : [$roles];

        return in_array($user->role, $roles, true);
    }
}
