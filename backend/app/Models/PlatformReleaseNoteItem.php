<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformReleaseNoteItem extends Model
{
    protected $fillable = [
        'release_note_id',
        'category',
        'body',
        'sort_order',
    ];

    protected $hidden = [
        'release_note_id',
        'sort_order',
        'created_at',
        'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function releaseNote(): BelongsTo
    {
        return $this->belongsTo(PlatformReleaseNote::class, 'release_note_id');
    }
}
