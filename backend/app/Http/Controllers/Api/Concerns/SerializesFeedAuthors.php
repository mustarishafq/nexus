<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\User;

trait SerializesFeedAuthors
{
    /**
     * @return array<string, mixed>
     */
    protected function serializeFeedAuthor(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'full_name' => $user->full_name ?: $user->name,
            'profile_picture' => $user->profile_picture,
            'department' => $user->department?->name,
        ];
    }
}
