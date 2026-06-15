<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserWorkExperience extends Model
{
    protected $table = 'user_work_experiences';

    protected $fillable = [
        'user_id',
        'company',
        'job_title',
        'date_from',
        'date_to',
        'description',
        'sort_order',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
