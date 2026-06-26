<?php

use App\Http\Controllers\Api\McpController;
use App\Http\Controllers\Api\OAuthController;
use App\Http\Controllers\OAuthAuthorizeRedirectController;
use App\Http\Controllers\OAuthDiscoveryController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/.well-known/oauth-authorization-server', [OAuthDiscoveryController::class, 'metadata']);
Route::get('/.well-known/oauth-protected-resource', [OAuthDiscoveryController::class, 'protectedResource']);
Route::get('/.well-known/oauth-protected-resource/mcp', [OAuthDiscoveryController::class, 'protectedResource']);
Route::get('/oauth/authorize', OAuthAuthorizeRedirectController::class);
Route::post('/oauth/token', [OAuthController::class, 'token']);

// Root-level DCR path: some MCP clients POST /register on the issuer host
// instead of the registration_endpoint from discovery metadata.
Route::post('/register', [OAuthController::class, 'register']);

// Canonical MCP URL (no /api prefix) so it matches the bare-URL form
// expected by hosted "Add custom connector" flows. /api/mcp still works.
Route::post('/mcp', [McpController::class, 'handle']);

Route::get('/privacy-policy', function () {
    $frontendUrl = rtrim((string) env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')), '/');

    return redirect()->away("{$frontendUrl}/privacy-policy");
});
