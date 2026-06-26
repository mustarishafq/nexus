<?php

use App\Http\Controllers\Api\AdminNotificationController;
use App\Http\Controllers\Api\AccessGroupController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\ApiTokenController;
use App\Http\Controllers\Api\AppSettingController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BroadcastController;
use App\Http\Controllers\Api\CalendarEventController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\AttendanceLocationController;
use App\Http\Controllers\Api\DepartmentAttendanceController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\FeedController;
use App\Http\Controllers\Api\PostCommentController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\PostReactionController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\ApplicationCalendarWebhookController;
use App\Http\Controllers\Api\ApplicationEventWebhookController;
use App\Http\Controllers\Api\ApplicationMcpCatalogController;
use App\Http\Controllers\Api\ApplicationSsoCredentialAdminController;
use App\Http\Controllers\Api\ApplicationSsoCredentialController;
use App\Http\Controllers\Api\FileUploadController;
use App\Http\Controllers\Api\GoogleOAuthController;
use App\Http\Controllers\Api\McpController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\OAuthController;
use App\Http\Controllers\Api\MetabaseDashboardController;
use App\Http\Controllers\Api\NetworkHealthController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PwaController;
use App\Http\Controllers\Api\SystemEventController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserSystemAccessController;
use App\Http\Controllers\Api\UserTodoController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/logout', [AuthController::class, 'logout']);

Route::get('/google/oauth/callback', [GoogleOAuthController::class, 'callback']);

Route::post('/mcp', [McpController::class, 'handle']);

Route::post('/oauth/register', [OAuthController::class, 'register']);
Route::get('/oauth/clients/{clientId}', [OAuthController::class, 'showClient']);
Route::post('/oauth/authorize/decide', [OAuthController::class, 'decide']);
Route::post('/oauth/token', [OAuthController::class, 'token']);

Route::get('/app-settings', [AppSettingController::class, 'publicShow']);
Route::get('/pwa/manifest', [PwaController::class, 'manifest']);

Route::get('/me', [MeController::class, 'show']);
Route::patch('/me', [MeController::class, 'update']);
Route::get('/attendance/export', [AttendanceController::class, 'exportCsv']);
Route::get('/attendance/watermark-logo', [AttendanceController::class, 'watermarkLogo']);
Route::get('/attendance/reverse-geocode', [AttendanceController::class, 'reverseGeocode']);
Route::get('/attendance/status', [AttendanceController::class, 'status']);
Route::get('/attendance/my-history', [AttendanceController::class, 'myHistory']);
Route::post('/attendance/clock', [AttendanceController::class, 'store']);
Route::get('/attendance/dashboard', [AttendanceController::class, 'dashboard']);
Route::get('/attendance/users/{user}/history', [AttendanceController::class, 'userHistory']);

Route::get('/network-health/ping', [NetworkHealthController::class, 'ping']);
Route::get('/network-health/download-test', [NetworkHealthController::class, 'downloadTest']);
Route::post('/network-health/upload-test', [NetworkHealthController::class, 'uploadTest']);
Route::get('/network-health/client-info', [NetworkHealthController::class, 'clientInfo']);
Route::post('/network-health/logs', [NetworkHealthController::class, 'storeLog']);
Route::get('/network-health/dashboard', [NetworkHealthController::class, 'dashboard']);
Route::get('/network-health/export', [NetworkHealthController::class, 'exportCsv']);
Route::get('/network-health/users/{user}/history', [NetworkHealthController::class, 'userHistory']);
Route::patch('/network-health/alerts/acknowledge-all', [NetworkHealthController::class, 'acknowledgeAllAlerts']);
Route::patch('/network-health/alerts/{networkHealthAlert}/acknowledge', [NetworkHealthController::class, 'acknowledgeAlert']);

Route::get('/dashboard/celebrations', [DashboardController::class, 'celebrations']);
Route::post('/dashboard/celebrations/wishes', [DashboardController::class, 'storeWish']);
Route::delete('/dashboard/celebrations/wishes/{celebrationWish}', [DashboardController::class, 'destroyWish']);
Route::get('/dashboard/action-items', [UserTodoController::class, 'index']);
Route::patch('/dashboard/action-items/{userTodo}/complete', [UserTodoController::class, 'complete']);
Route::get('/feed', [FeedController::class, 'index']);
Route::post('/posts', [PostController::class, 'store']);
Route::delete('/posts/{post}', [PostController::class, 'destroy']);
Route::post('/posts/{post}/reactions', [PostReactionController::class, 'store']);
Route::delete('/posts/{post}/reactions', [PostReactionController::class, 'destroy']);
Route::get('/posts/{post}/comments', [PostCommentController::class, 'index']);
Route::post('/posts/{post}/comments', [PostCommentController::class, 'store']);
Route::delete('/post-comments/{postComment}', [PostCommentController::class, 'destroy']);
Route::get('/conversations', [ConversationController::class, 'index']);
Route::post('/conversations', [ConversationController::class, 'store']);
Route::get('/conversations/{conversation}/messages', [ConversationController::class, 'messages']);
Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'sendMessage']);
Route::patch('/conversations/{conversation}/read', [ConversationController::class, 'markRead']);
Route::delete('/conversations/{conversation}', [ConversationController::class, 'destroy']);
Route::get('/google/oauth/status', [GoogleOAuthController::class, 'status']);
Route::post('/google/oauth/connect', [GoogleOAuthController::class, 'connect']);
Route::delete('/google/oauth/disconnect', [GoogleOAuthController::class, 'disconnect']);

Route::post('/admin/notifications/send', [AdminNotificationController::class, 'send']);
Route::get('/admin/api-tokens', [ApiTokenController::class, 'index']);
Route::post('/admin/api-tokens', [ApiTokenController::class, 'store']);
Route::delete('/admin/api-tokens/{apiToken}', [ApiTokenController::class, 'destroy']);
Route::get('/admin/sso-credentials', [ApplicationSsoCredentialAdminController::class, 'index']);
Route::patch('/admin/sso-credentials/{ssoCredential}', [ApplicationSsoCredentialAdminController::class, 'update']);
Route::get('/admin/app-settings', [AppSettingController::class, 'show']);
Route::patch('/admin/app-settings', [AppSettingController::class, 'update']);
Route::get('/admin/attendance-locations', [AttendanceLocationController::class, 'index']);
Route::post('/admin/attendance-locations', [AttendanceLocationController::class, 'store']);
Route::put('/admin/attendance-locations/{attendanceLocation}', [AttendanceLocationController::class, 'update']);
Route::delete('/admin/attendance-locations/{attendanceLocation}', [AttendanceLocationController::class, 'destroy']);
Route::get('/admin/department-attendance', [DepartmentAttendanceController::class, 'index']);
Route::get('/admin/department-attendance/{department}', [DepartmentAttendanceController::class, 'show']);
Route::put('/admin/department-attendance/{department}', [DepartmentAttendanceController::class, 'update']);

Route::get('/departments', [DepartmentController::class, 'index']);
Route::post('/departments', [DepartmentController::class, 'store']);
Route::get('/users/directory', [UserController::class, 'directory']);
Route::get('/users/org-chart', [UserController::class, 'orgChart']);
Route::get('/users', [UserController::class, 'index']);
Route::get('/users/search', [UserController::class, 'search']);
Route::post('/users', [UserController::class, 'store']);
Route::post('/users/import-csv', [UserController::class, 'importCsv']);
Route::post('/users/import-hr-onboarding-csv', [UserController::class, 'importHrOnboardingCsv']);
Route::post('/users/assign-access-groups-csv', [UserController::class, 'assignAccessGroupsCsv']);
Route::post('/users/nudge-incomplete-profiles', [UserController::class, 'nudgeIncompleteProfiles']);
Route::get('/users/{user}/profile', [UserController::class, 'profile']);
Route::post('/users/{user}/profile-nudge', [UserController::class, 'profileNudge']);
Route::get('/users/{user}', [UserController::class, 'show']);
Route::patch('/users/{user}', [UserController::class, 'update']);
Route::delete('/users/{user}', [UserController::class, 'destroy']);

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
Route::get('applications/{application}/sso-credentials', [ApplicationSsoCredentialController::class, 'index']);
Route::post('applications/{application}/sso-credentials', [ApplicationSsoCredentialController::class, 'store']);
Route::delete('applications/{application}/sso-credentials/{ssoCredential}', [ApplicationSsoCredentialController::class, 'destroy']);
Route::post('applications/{application}/event-webhook', [ApplicationEventWebhookController::class, 'store']);
Route::post('applications/{application}/event-webhook/preview', [ApplicationEventWebhookController::class, 'preview']);
Route::post('applications/{application}/calendar-webhook', [ApplicationCalendarWebhookController::class, 'store']);
Route::post('applications/{application}/calendar-webhook/preview', [ApplicationCalendarWebhookController::class, 'preview']);
Route::post('applications/{application}/mcp-catalog/test', [ApplicationMcpCatalogController::class, 'test']);
Route::apiResource('access-groups', AccessGroupController::class);
Route::apiResource('metabase-dashboards', MetabaseDashboardController::class);
Route::apiResource('user-system-accesses', UserSystemAccessController::class);
Route::apiResource('broadcasts', BroadcastController::class);
Route::apiResource('notifications', NotificationController::class);
Route::apiResource('system-events', SystemEventController::class);
Route::apiResource('calendar-events', CalendarEventController::class);
Route::apiResource('activity-logs', ActivityLogController::class);
