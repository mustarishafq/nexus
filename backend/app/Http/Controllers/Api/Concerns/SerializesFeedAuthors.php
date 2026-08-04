<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\User;
use App\Support\UserProfileSerializer;

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

        return array_merge([
            'id' => $user->id,
            'name' => $user->displayName(),
            'profile_picture' => $user->profile_picture,
            'profile_picture_crop' => $user->profile_picture_crop,
            'department' => $user->department?->name,
        ], UserProfileSerializer::expDirectoryFields($user));
    }
}
