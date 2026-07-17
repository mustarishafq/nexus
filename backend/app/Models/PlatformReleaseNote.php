<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

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
        'version',
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

    /**
     * @param  array<int, mixed>|null  $items
     * @return array<int, array{category: string, body: string}>
     */
    public static function normalizeItems(?array $items): array
    {
        $normalized = [];

        foreach ($items ?? [] as $item) {
            if (! is_array($item)) {
                continue;
            }

            $category = (string) ($item['category'] ?? self::CATEGORY_FEATURE);
            if (! in_array($category, self::CATEGORIES, true)) {
                $category = self::CATEGORY_FEATURE;
            }

            $body = trim((string) ($item['body'] ?? ''));
            if ($body === '') {
                continue;
            }

            $normalized[] = [
                'category' => $category,
                'body' => $body,
            ];
        }

        return $normalized;
    }

    /**
     * @param  array<int, array{category: string, body: string}>  $items
     */
    public function syncItems(array $items): void
    {
        DB::transaction(function () use ($items) {
            $this->items()->delete();

            foreach (array_values($items) as $index => $item) {
                $this->items()->create([
                    'category' => $item['category'],
                    'body' => $item['body'],
                    'sort_order' => $index,
                ]);
            }
        });
    }

    public function items(): HasMany
    {
        return $this->hasMany(PlatformReleaseNoteItem::class, 'release_note_id')
            ->orderBy('sort_order')
            ->orderBy('id');
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
