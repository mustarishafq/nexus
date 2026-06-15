<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserEducation extends Model
{
    protected $table = 'user_educations';

    protected $fillable = [
        'user_id',
        'institution',
        'qualification',
        'field_of_study',
        'year_from',
        'year_to',
        'sort_order',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
