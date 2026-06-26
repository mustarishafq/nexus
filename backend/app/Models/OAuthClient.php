<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OAuthClient extends Model
{
    protected $table = 'oauth_clients';

    protected $fillable = [
        'client_id',
        'client_secret_hash',
        'name',
        'redirect_uris',
        'token_endpoint_auth_method',
    ];

    protected function casts(): array
    {
        return [
            'redirect_uris' => 'array',
        ];
    }

    public function allowsRedirectUri(string $redirectUri): bool
    {
        return in_array($redirectUri, $this->redirect_uris ?? [], true);
    }
}
