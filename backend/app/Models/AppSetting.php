<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'system_name',
        'smtp_from_email',
    ];

    public static function defaults(): array
    {
        return [
            'system_name' => config('app.name', 'Nexus'),
            'smtp_from_email' => config('mail.from.address'),
        ];
    }

    public static function singleton(): self
    {
        return self::query()->first() ?? new self(self::defaults());
    }

    public function publicPayload(): array
    {
        return [
            'system_name' => $this->system_name ?: config('app.name', 'Nexus'),
        ];
    }

    public function adminPayload(): array
    {
        return [
            'system_name' => $this->system_name ?: config('app.name', 'Nexus'),
            'smtp_from_email' => $this->smtp_from_email ?: config('mail.from.address'),
        ];
    }
}