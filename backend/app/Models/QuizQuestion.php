<?php

namespace App\Models;

use App\Support\PublicStorageUrl;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuizQuestion extends Model
{
    public const TYPE_MULTIPLE_CHOICE = 'multiple_choice';

    public const TYPE_TRUE_FALSE = 'true_false';

    public const TRUE_LABEL = 'True';

    public const FALSE_LABEL = 'False';

    public const TYPES = [
        self::TYPE_MULTIPLE_CHOICE,
        self::TYPE_TRUE_FALSE,
    ];

    public static function isTrueFalse(mixed $type): bool
    {
        return $type === self::TYPE_TRUE_FALSE;
    }

    protected $fillable = [
        'quiz_id',
        'prompt',
        'image_url',
        'question_type',
        'time_limit_seconds',
        'points_base',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'time_limit_seconds' => 'integer',
            'points_base' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    /**
     * Persist and expose public-disk images as /storage/... so clients are not
     * tied to APP_URL or an /api prefix.
     */
    public static function canonicalImageUrl(mixed $url): ?string
    {
        return PublicStorageUrl::canonicalize($url);
    }

    protected function imageUrl(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => self::canonicalImageUrl($value),
            set: fn (mixed $value) => self::canonicalImageUrl($value),
        );
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(QuizOption::class)->orderBy('sort_order')->orderBy('id');
    }
}
