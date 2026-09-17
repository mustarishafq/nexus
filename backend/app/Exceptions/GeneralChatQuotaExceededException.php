<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class GeneralChatQuotaExceededException extends RuntimeException
{
    /**
     * @param  array<string, mixed>  $quota
     */
    public function __construct(public array $quota)
    {
        parent::__construct('You have used your Chat token limit for this period.');
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'quota' => $this->quota,
        ], 429);
    }
}
