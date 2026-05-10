<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Models\GoogleOAuthToken;
use App\Models\User;
use Google\Client;
use Google\Service\Calendar;
use Google\Service\Calendar\Event;
use Google\Service\Calendar\EventDateTime;
use Illuminate\Support\Facades\Crypt;
use RuntimeException;
use Throwable;

class GoogleCalendarService
{
    public function isConfigured(): bool
    {
        return filled(config('services.google_oauth.client_id'))
            && filled(config('services.google_oauth.client_secret'))
            && GoogleOAuthToken::query()->where('provider', 'google')->exists();
    }

    protected function isConfiguredForEvent(CalendarEvent $calendarEvent): bool
    {
        return filled(config('services.google_oauth.client_id'))
            && filled(config('services.google_oauth.client_secret'))
            && $this->oauthTokenForEvent($calendarEvent) !== null;
    }

    public function syncEvent(CalendarEvent $calendarEvent): array
    {
        if (! $this->isConfiguredForEvent($calendarEvent)) {
            return [
                'success' => false,
                'event_id' => $calendarEvent->google_event_id,
                'url' => $calendarEvent->google_calendar_url,
                'error' => 'Google Calendar is not configured.',
            ];
        }

        $calendarId = $this->configuredCalendarId();
        $oauthToken = $this->oauthTokenForEvent($calendarEvent);

        try {
            $service = $this->calendarService($calendarEvent);
            $googleEvent = $this->buildGoogleEvent($calendarEvent);
            $synced = $this->upsertEvent($service, $calendarEvent, $googleEvent, $calendarId, true);

            return [
                'success' => true,
                'event_id' => $synced->getId(),
                'url' => $synced->getHtmlLink(),
                'error' => null,
            ];
        } catch (Throwable $exception) {
            $message = (string) $exception->getMessage();

            if ($oauthToken && $this->isCalendarNotFound($message) && $calendarId !== 'primary') {
                try {
                    $service = $this->calendarService($calendarEvent);
                    $googleEvent = $this->buildGoogleEvent($calendarEvent);
                    $synced = $this->upsertEvent($service, $calendarEvent, $googleEvent, 'primary', true);

                    return [
                        'success' => true,
                        'event_id' => $synced->getId(),
                        'url' => $synced->getHtmlLink(),
                        'error' => 'Configured calendar was not accessible for this OAuth user. Synced to primary calendar instead.',
                    ];
                } catch (Throwable $primaryException) {
                    $message = (string) $primaryException->getMessage();
                    $calendarId = 'primary';
                }
            }

            // Service accounts outside domain-wide delegation cannot invite attendees.
            if ($this->isServiceAccountInviteRestriction($message) && $this->hasAttendees($calendarEvent)) {
                return $this->syncEventWithoutAttendees($calendarEvent, $message, $calendarId);
            }

            return [
                'success' => false,
                'event_id' => $calendarEvent->google_event_id,
                'url' => $calendarEvent->google_calendar_url,
                'error' => $message,
            ];
        }
    }

    public function deleteEvent(CalendarEvent $calendarEvent): array
    {
        if (! $this->isConfiguredForEvent($calendarEvent)) {
            return [
                'success' => false,
                'error' => 'Google Calendar is not configured.',
            ];
        }

        if (empty($calendarEvent->google_event_id)) {
            return [
                'success' => true,
                'error' => null,
            ];
        }

        try {
            $service = $this->calendarService($calendarEvent);
            $calendarId = $this->configuredCalendarId();
            $service->events->delete($calendarId, $calendarEvent->google_event_id, ['sendUpdates' => 'all']);

            return [
                'success' => true,
                'error' => null,
            ];
        } catch (Throwable $exception) {
            $message = (string) $exception->getMessage();
            $oauthToken = $this->oauthTokenForEvent($calendarEvent);

            if ($oauthToken && $this->isCalendarNotFound($message) && $this->configuredCalendarId() !== 'primary') {
                try {
                    $service = $this->calendarService($calendarEvent);
                    $service->events->delete('primary', $calendarEvent->google_event_id, ['sendUpdates' => 'all']);

                    return [
                        'success' => true,
                        'error' => null,
                    ];
                } catch (Throwable $primaryException) {
                    $message = (string) $primaryException->getMessage();
                }
            }

            return [
                'success' => false,
                'error' => $message,
            ];
        }
    }

    protected function calendarService(CalendarEvent $calendarEvent): Calendar
    {
        $oauthToken = $this->oauthTokenForEvent($calendarEvent);

        if (! $oauthToken) {
            throw new RuntimeException('Google OAuth token not found for this event owner.');
        }

        $client = new Client();
        $client->setClientId((string) config('services.google_oauth.client_id'));
        $client->setClientSecret((string) config('services.google_oauth.client_secret'));
        $client->setScopes([Calendar::CALENDAR]);

        $accessToken = Crypt::decryptString($oauthToken->access_token);
        $refreshToken = $oauthToken->refresh_token ? Crypt::decryptString($oauthToken->refresh_token) : null;

        $expiresIn = null;
        if ($oauthToken->expires_at) {
            $expiresIn = max(0, $oauthToken->expires_at->diffInSeconds(now(), false) * -1);
        }

        $client->setAccessToken([
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'expires_in' => $expiresIn,
            'created' => time(),
            'token_type' => $oauthToken->token_type ?: 'Bearer',
        ]);

        if ($client->isAccessTokenExpired() && $refreshToken) {
            $newToken = $client->fetchAccessTokenWithRefreshToken($refreshToken);

            if (! isset($newToken['error']) && ! empty($newToken['access_token'])) {
                $oauthToken->update([
                    'access_token' => Crypt::encryptString($newToken['access_token']),
                    'refresh_token' => ! empty($newToken['refresh_token'])
                        ? Crypt::encryptString($newToken['refresh_token'])
                        : $oauthToken->refresh_token,
                    'expires_at' => isset($newToken['expires_in']) ? now()->addSeconds((int) $newToken['expires_in']) : $oauthToken->expires_at,
                    'token_type' => (string) ($newToken['token_type'] ?? $oauthToken->token_type),
                ]);
            }
        }

        return new Calendar($client);
    }

    protected function buildGoogleEvent(CalendarEvent $calendarEvent): Event
    {
        $event = new Event([
            'summary' => $calendarEvent->title,
            'description' => (string) $calendarEvent->description,
            'location' => (string) $calendarEvent->location,
        ]);

        if ($calendarEvent->is_all_day) {
            $start = $calendarEvent->start_at->copy()->format('Y-m-d');
            $end = $calendarEvent->end_at->copy()->addDay()->format('Y-m-d');

            $event->setStart(new EventDateTime(['date' => $start]));
            $event->setEnd(new EventDateTime(['date' => $end]));
        } else {
            $timezone = (string) config('services.google_oauth.timezone', config('app.timezone', 'UTC'));

            $event->setStart(new EventDateTime([
                'dateTime' => $calendarEvent->start_at->copy()->toIso8601String(),
                'timeZone' => $timezone,
            ]));

            $event->setEnd(new EventDateTime([
                'dateTime' => $calendarEvent->end_at->copy()->toIso8601String(),
                'timeZone' => $timezone,
            ]));
        }

        $attendees = [];
        $emails = $calendarEvent->attendee_emails;

        if (is_array($emails)) {
            foreach ($emails as $email) {
                if (! is_string($email) || $email === '') {
                    continue;
                }

                $attendees[] = ['email' => $email];
            }
        }

        if (! empty($attendees)) {
            $event->setAttendees($attendees);
        }

        return $event;
    }

    protected function syncEventWithoutAttendees(CalendarEvent $calendarEvent, string $originalError, string $calendarId): array
    {
        try {
            $service = $this->calendarService($calendarEvent);
            $eventWithoutAttendees = $this->buildGoogleEvent($calendarEvent);
            $eventWithoutAttendees->setAttendees([]);

            $synced = $this->upsertEvent($service, $calendarEvent, $eventWithoutAttendees, $calendarId, false);

            return [
                'success' => true,
                'event_id' => $synced->getId(),
                'url' => $synced->getHtmlLink(),
                'error' => 'Event synced to Google Calendar without attendee invites. Original API response: ' . $originalError,
            ];
        } catch (Throwable $fallbackException) {
            return [
                'success' => false,
                'event_id' => $calendarEvent->google_event_id,
                'url' => $calendarEvent->google_calendar_url,
                'error' => $fallbackException->getMessage(),
            ];
        }
    }

    protected function isServiceAccountInviteRestriction(string $message): bool
    {
        return str_contains($message, 'forbiddenForServiceAccounts')
            || str_contains($message, 'Service accounts cannot invite attendees');
    }

    protected function isCalendarNotFound(string $message): bool
    {
        return str_contains($message, '"reason": "notFound"')
            || str_contains($message, '"message": "Not Found"')
            || str_contains($message, 'Not Found');
    }

    protected function hasAttendees(CalendarEvent $calendarEvent): bool
    {
        $emails = $calendarEvent->attendee_emails;

        return is_array($emails) && ! empty($emails);
    }

    protected function oauthTokenForEvent(CalendarEvent $calendarEvent): ?GoogleOAuthToken
    {
        if (! filled(config('services.google_oauth.client_id')) || ! filled(config('services.google_oauth.client_secret'))) {
            return null;
        }

        if ($calendarEvent->created_by) {
            $user = User::query()->where('email', $calendarEvent->created_by)->first();
            if ($user) {
                $token = GoogleOAuthToken::query()
                    ->where('provider', 'google')
                    ->where('user_id', $user->id)
                    ->first();

                if ($token) {
                    return $token;
                }
            }
        }

        return GoogleOAuthToken::query()
            ->where('provider', 'google')
            ->latest('updated_at')
            ->first();
    }

    protected function upsertEvent(Calendar $service, CalendarEvent $calendarEvent, Event $event, string $calendarId, bool $sendUpdates): Event
    {
        if (! empty($calendarEvent->google_event_id)) {
            return $service->events->update($calendarId, $calendarEvent->google_event_id, $event);
        }

        $options = $sendUpdates ? ['sendUpdates' => 'all'] : [];

        return $service->events->insert($calendarId, $event, $options);
    }

    protected function configuredCalendarId(): string
    {
        $calendarId = trim((string) config('services.google_oauth.calendar_id', 'primary'));

        return $calendarId !== '' ? $calendarId : 'primary';
    }
}
