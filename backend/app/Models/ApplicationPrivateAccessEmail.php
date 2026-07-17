<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicationPrivateAccessEmail extends Model
{
    protected $fillable = [
        'application_id',
        'email',
    ];

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
