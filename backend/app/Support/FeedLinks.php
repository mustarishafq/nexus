<?php

namespace App\Support;

class FeedLinks
{
    public static function post(int $postId, bool $expandComments = false): string
    {
        $url = "/feed?post={$postId}";

        if ($expandComments) {
            $url .= '&comments=1';
        }

        return $url;
    }
}
