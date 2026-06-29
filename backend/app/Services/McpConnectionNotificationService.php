<?php

namespace App\Services;

use App\Models\AuthToken;
use App\Models\Notification;
use App\Models\OAuthClient;
use App\Models\User;

class McpConnectionNotificationService
{
    public function notifyAdminsOfNewConnection(User $user, OAuthClient $client, AuthToken $authToken): void
    {
        $userName = $user->displayName();
        $clientName = $client->name ?: 'MCP client';

        $admins = User::query()
            ->where('role', 'admin')
            ->where('is_approved', true)
            ->get(['id']);

        foreach ($admins as $admin) {
            $notification = Notification::create([
                'user_id' => (string) $admin->id,
                'type' => 'info',
                'priority' => 'medium',
                'category' => 'approval',
                'title' => 'New MCP connection',
                'message' => "{$userName} connected {$clientName} via MCP (read-only until you change their access).",
                'action_url' => '/admin/users?section=api-tokens',
                'is_read' => false,
                'is_broadcast' => false,
                'delivery_channels' => ['in_app'],
                'data' => [
                    'kind' => 'mcp_oauth_connection',
                    'auth_token_id' => $authToken->id,
                    'oauth_client_id' => $client->client_id,
                    'oauth_client_name' => $clientName,
                    'connected_user_id' => $user->id,
                    'connected_user_name' => $userName,
                    'connected_user_email' => $user->email,
                    'mcp_access' => $user->mcp_access,
                    'admin_section' => 'api-tokens',
                ],
            ]);

            app(PushNotificationService::class)->sendNotification($notification);
        }
    }

    public function isFirstOAuthConnection(User $user): bool
    {
        return ! AuthToken::query()
            ->where('user_id', $user->id)
            ->whereNotNull('oauth_client_id')
            ->exists();
    }
}
