<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PlatformReleaseNote extends Model
{
    public const CATEGORY_FEATURE = 'feature';

    public const CATEGORY_FIX = 'fix';

    public const CATEGORY_IMPROVEMENT = 'improvement';

    public const CATEGORIES = [
        self::CATEGORY_FEATURE,
        self::CATEGORY_FIX,
        self::CATEGORY_IMPROVEMENT,
    ];

    protected $fillable = [
        'created_by_user_id',
        'title',
        'body',
        'version',
        'category',
        'is_published',
        'published_at',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
        'published_date',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function readers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_platform_release_note_reads', 'release_note_id', 'user_id')
            ->withPivot('read_at')
            ->withTimestamps();
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at ? $this->created_at->toISOString() : null;
    }

    public function getUpdatedDateAttribute(): ?string
    {
        return $this->updated_at ? $this->updated_at->toISOString() : null;
    }

    public function getPublishedDateAttribute(): ?string
    {
        return $this->published_at ? $this->published_at->toISOString() : null;
    }
}
