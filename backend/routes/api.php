<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AppSettingController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BroadcastController;
use App\Http\Controllers\Api\CalendarEventController;
use App\Http\Controllers\Api\ConnectedSystemController;
use App\Http\Controllers\Api\FileUploadController;
use App\Http\Controllers\Api\GoogleOAuthController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PwaController;
use App\Http\Controllers\Api\SystemEventController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserSystemAccessController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/logout', [AuthController::class, 'logout']);

Route::get('/google/oauth/callback', [GoogleOAuthController::class, 'callback']);

Route::get('/app-settings', [AppSettingController::class, 'publicShow']);
Route::get('/pwa/manifest', [PwaController::class, 'manifest']);

Route::get('/me', [MeController::class, 'show']);
Route::patch('/me', [MeController::class, 'update']);
Route::get('/google/oauth/status', [GoogleOAuthController::class, 'status']);
Route::post('/google/oauth/connect', [GoogleOAuthController::class, 'connect']);
Route::delete('/google/oauth/disconnect', [GoogleOAuthController::class, 'disconnect']);

Route::get('/admin/app-settings', [AppSettingController::class, 'show']);
Route::patch('/admin/app-settings', [AppSettingController::class, 'update']);

Route::get('/users', [UserController::class, 'index']);
Route::post('/users', [UserController::class, 'store']);
Route::post('/users/import-csv', [UserController::class, 'importCsv']);
Route::get('/users/{user}', [UserController::class, 'show']);
Route::patch('/users/{user}', [UserController::class, 'update']);

Route::post('/uploads', [FileUploadController::class, 'store']);
Route::get('/push-subscriptions', function () {
	return app()->make('App\\Http\\Controllers\\Api\\PushSubscriptionController')->index(request());
});
Route::post('/push-subscriptions', function () {
	return app()->make('App\\Http\\Controllers\\Api\\PushSubscriptionController')->store(request());
});
Route::delete('/push-subscriptions', function () {
	return app()->make('App\\Http\\Controllers\\Api\\PushSubscriptionController')->destroy(request());
});

Route::apiResource('connected-systems', ConnectedSystemController::class);
Route::post('connected-systems/{connected_system}/launch', [ConnectedSystemController::class, 'launch']);
Route::apiResource('user-system-accesses', UserSystemAccessController::class);
Route::apiResource('broadcasts', BroadcastController::class);
Route::apiResource('notifications', NotificationController::class);
Route::apiResource('system-events', SystemEventController::class);
Route::apiResource('calendar-events', CalendarEventController::class);
Route::apiResource('activity-logs', ActivityLogController::class);
