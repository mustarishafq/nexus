<?php

namespace App\Support;

use App\Models\ProfileMediaComment;
use App\Models\ProfileMediaReaction;
use App\Models\User;

class ProfileMediaInteractions
{
    public static function clearFor(User $owner, string $mediaType): void
    {
        ProfileMediaReaction::query()
            ->where('owner_user_id', $owner->id)
            ->where('media_type', $mediaType)
            ->delete();

        ProfileMediaComment::query()
            ->where('owner_user_id', $owner->id)
            ->where('media_type', $mediaType)
            ->delete();
    }
}
