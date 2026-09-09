<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LlmUsageLog extends Model
{
    protected $fillable = [
        'user_id',
        'provider',
        'model',
        'feature',
        'application_slug',
        'prompt_tokens',
        'completion_tokens',
        'total_tokens',
        'reasoning_tokens',
        'cached_tokens',
        'cost',
        'upstream_cost',
        'generation_id',
        'request_count',
        'ok',
        'error_message',
        'input_text',
        'output_text',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'prompt_tokens' => 'integer',
            'completion_tokens' => 'integer',
            'total_tokens' => 'integer',
            'reasoning_tokens' => 'integer',
            'cached_tokens' => 'integer',
            'cost' => 'float',
            'upstream_cost' => 'float',
            'request_count' => 'integer',
            'ok' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
