<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserApplicationMcpAccess extends Model
{
    protected $table = 'user_application_mcp_access';

    protected $fillable = [
        'user_id',
        'application_id',
        'mcp_access',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
