<?php

use App\Http\Controllers\Api\AccessGroupController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AppSettingController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BroadcastController;
use App\Http\Controllers\Api\CalendarEventController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\FileUploadController;
use App\Http\Controllers\Api\GoogleOAuthController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\MetabaseDashboardController;
use App\Http\Controllers\Api\NetworkHealthController;
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
Route::get('/network-health/ping', [NetworkHealthController::class, 'ping']);
Route::get('/network-health/download-test', [NetworkHealthController::class, 'downloadTest']);
Route::post('/network-health/upload-test', [NetworkHealthController::class, 'uploadTest']);
Route::get('/network-health/client-info', [NetworkHealthController::class, 'clientInfo']);
Route::post('/network-health/logs', [NetworkHealthController::class, 'storeLog']);
Route::get('/network-health/dashboard', [NetworkHealthController::class, 'dashboard']);
Route::get('/network-health/export', [NetworkHealthController::class, 'exportCsv']);
Route::get('/network-health/users/{user}/history', [NetworkHealthController::class, 'userHistory']);
Route::patch('/network-health/alerts/{networkHealthAlert}/acknowledge', [NetworkHealthController::class, 'acknowledgeAlert']);

Route::get('/dashboard/celebrations', [DashboardController::class, 'celebrations']);
Route::post('/dashboard/celebrations/wishes', [DashboardController::class, 'storeWish']);
Route::delete('/dashboard/celebrations/wishes/{celebrationWish}', [DashboardController::class, 'destroyWish']);
Route::get('/google/oauth/status', [GoogleOAuthController::class, 'status']);
Route::post('/google/oauth/connect', [GoogleOAuthController::class, 'connect']);
Route::delete('/google/oauth/disconnect', [GoogleOAuthController::class, 'disconnect']);

Route::get('/admin/app-settings', [AppSettingController::class, 'show']);
Route::patch('/admin/app-settings', [AppSettingController::class, 'update']);

Route::get('/users', [UserController::class, 'index']);
Route::post('/users', [UserController::class, 'store']);
Route::post('/users/import-csv', [UserController::class, 'importCsv']);
Route::post('/users/assign-access-groups-csv', [UserController::class, 'assignAccessGroupsCsv']);
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

Route::post('applications/reorder', [ApplicationController::class, 'reorder']);
Route::get('applications/usage-stats', [ApplicationController::class, 'usageStats']);
Route::apiResource('applications', ApplicationController::class);
Route::post('applications/{application}/launch', [ApplicationController::class, 'launch']);
Route::apiResource('access-groups', AccessGroupController::class);
Route::apiResource('metabase-dashboards', MetabaseDashboardController::class);
Route::apiResource('user-system-accesses', UserSystemAccessController::class);
Route::apiResource('broadcasts', BroadcastController::class);
Route::apiResource('notifications', NotificationController::class);
Route::apiResource('system-events', SystemEventController::class);
Route::apiResource('calendar-events', CalendarEventController::class);
Route::apiResource('activity-logs', ActivityLogController::class);
