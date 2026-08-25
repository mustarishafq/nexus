<?php

namespace App\Models;

use App\Services\PermissionService;
use App\Support\PermissionCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use SoftDeletes;

    public const APPROVAL_APPROVED = 'approved';

    public const APPROVAL_PENDING = 'pending';

    public const MAX_IMAGES = 10;

    protected $fillable = [
        'author_user_id',
        'body',
        'image_url',
        'image_urls',
        'approval_status',
        'approved_by_user_id',
        'approved_at',
        'edited_at',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'edited_at' => 'datetime',
        'deleted_at' => 'datetime',
        'image_urls' => 'array',
    ];

    protected $appends = [
        'created_date',
        'updated_date',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(PostReaction::class);
    }

    public function edits(): HasMany
    {
        return $this->hasMany(PostEdit::class)->orderByDesc('created_at');
    }

    public function views(): HasMany
    {
        return $this->hasMany(PostView::class);
    }

    public function reaches(): HasMany
    {
        return $this->hasMany(PostReach::class);
    }

    public function polls(): HasMany
    {
        return $this->hasMany(PostPoll::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * @deprecated Use polls() — kept for transitional callers that expect a single poll.
     */
    public function poll(): HasOne
    {
        return $this->hasOne(PostPoll::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * @return list<string>
     */
    public function resolvedImageUrls(): array
    {
        $urls = collect($this->image_urls ?? [])
            ->map(fn ($url) => trim((string) $url))
            ->filter()
            ->values()
            ->all();

        if ($urls === [] && filled($this->image_url)) {
            $urls = [trim((string) $this->image_url)];
        }

        return array_values(array_unique($urls));
    }

    public function isApproved(): bool
    {
        return ($this->approval_status ?? self::APPROVAL_APPROVED) === self::APPROVAL_APPROVED;
    }

    public function isPending(): bool
    {
        return ($this->approval_status ?? self::APPROVAL_APPROVED) === self::APPROVAL_PENDING;
    }

    public function scopeApproved(Builder $query): Builder
    {
        return $query->where('approval_status', self::APPROVAL_APPROVED);
    }

    public function scopeVisibleTo(Builder $query, User $viewer): Builder
    {
        $query->withTrashed();

        if (PermissionService::can($viewer, PermissionCatalog::FEED_MODERATE)) {
            return $query->whereIn('approval_status', [self::APPROVAL_APPROVED, self::APPROVAL_PENDING]);
        }

        return $query->where(function (Builder $inner) use ($viewer) {
            $inner->where(function (Builder $live) use ($viewer) {
                $live->whereNull($this->getQualifiedDeletedAtColumn())
                    ->where(function (Builder $approval) use ($viewer) {
                        $approval->where('approval_status', self::APPROVAL_APPROVED)
                            ->orWhere(function (Builder $ownPending) use ($viewer) {
                                $ownPending
                                    ->where('approval_status', self::APPROVAL_PENDING)
                                    ->where('author_user_id', $viewer->id);
                            });
                    });
            })->orWhere(function (Builder $ownDeleted) use ($viewer) {
                $ownDeleted
                    ->whereNotNull($this->getQualifiedDeletedAtColumn())
                    ->where('author_user_id', $viewer->id);
            });
        });
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return static::withTrashed()
            ->where($field ?? $this->getRouteKeyName(), $value)
            ->first();
    }

    public function getCreatedDateAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }

    public function getUpdatedDateAttribute(): ?string
    {
        return $this->updated_at?->toISOString();
    }
}
