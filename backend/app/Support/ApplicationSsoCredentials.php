<?php

namespace App\Support;

use App\Models\Application;
use App\Models\ApplicationSsoCredential;
use App\Models\User;
use Illuminate\Support\Collection;

class ApplicationSsoCredentials
{
    /**
     * @return array<int, array{id: string, email: string, label: string, primary: bool}>
     */
    public static function launchOptions(User $user, Application $application): array
    {
        $options = [];
        $seenEmails = [];

        $primaryEmail = strtolower(trim((string) ($user->email ?? '')));
        if ($primaryEmail !== '') {
            $options[] = [
                'id' => 'primary',
                'email' => $user->email,
                'label' => 'Nexus account',
                'primary' => true,
            ];
            $seenEmails[$primaryEmail] = true;
        }

        $credentials = ApplicationSsoCredential::query()
            ->where('user_id', $user->id)
            ->where('application_id', $application->id)
            ->where('status', ApplicationSsoCredential::STATUS_APPROVED)
            ->orderBy('email')
            ->get();

        foreach ($credentials as $credential) {
            $normalizedEmail = strtolower(trim($credential->email));
            if ($normalizedEmail === '' || isset($seenEmails[$normalizedEmail])) {
                continue;
            }

            $options[] = [
                'id' => (string) $credential->id,
                'email' => $credential->email,
                'label' => trim((string) ($credential->label ?? '')) ?: $credential->email,
                'primary' => false,
            ];
            $seenEmails[$normalizedEmail] = true;
        }

        return $options;
    }

    public static function resolveLaunchEmail(User $user, Application $application, mixed $requestedEmail): ?string
    {
        $options = self::launchOptions($user, $application);

        if ($options === []) {
            return null;
        }

        if (! is_string($requestedEmail) || trim($requestedEmail) === '') {
            return $options[0]['email'];
        }

        $normalizedRequested = strtolower(trim($requestedEmail));

        foreach ($options as $option) {
            if (strtolower(trim($option['email'])) === $normalizedRequested) {
                return $option['email'];
            }
        }

        return null;
    }

    /**
     * @return Collection<int, ApplicationSsoCredential>
     */
    public static function storedCredentials(User $user, Application $application): Collection
    {
        return ApplicationSsoCredential::query()
            ->where('user_id', $user->id)
            ->where('application_id', $application->id)
            ->orderBy('email')
            ->get();
    }
}
