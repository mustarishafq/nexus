<?php

namespace App\Support;

use App\Models\Application;
use App\Models\ApplicationSsoCredential;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Support\Collection;

class ApplicationSsoCredentials
{
    public const LAUNCH_TTL_SECONDS = 60;

    public const API_TTL_SECONDS = 120;

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
     * @return array<string, mixed>
     */
    public static function launchPayload(
        User $user,
        Application $application,
        string $ssoEmail,
        ?string $returnTo = null,
        ?string $redirectTo = null,
        int $ttlSeconds = self::LAUNCH_TTL_SECONDS,
        ?int $now = null,
    ): array {
        $now ??= time();
        $primaryEmail = strtolower(trim((string) ($user->email ?? '')));
        $isAdditionalSsoEmail = $primaryEmail !== ''
            && strtolower(trim($ssoEmail)) !== $primaryEmail;

        $payload = [
            'iss' => config('app.url'),
            'iat' => $now,
            'exp' => $now + max(1, $ttlSeconds),
            'sub' => (string) $user->id,
            'email' => $ssoEmail,
            'sys' => $application->slug,
            'return_to' => $returnTo ?: rtrim((string) config('app.url'), '/').'/applications',
        ];

        // Additional SSO emails authenticate an existing app account — do not push Nexus profile fields.
        if (! $isAdditionalSsoEmail) {
            $payload['name'] = $user->name ?? '';

            if ($user->profile_picture) {
                $payload['profile_picture'] = $user->profile_picture;
            }

            if (self::isCampusApplication($application)) {
                $fullName = trim((string) ($user->full_name ?? ''));
                if ($fullName !== '') {
                    $payload['full_name'] = $fullName;
                }

                $user->loadMissing('department');
                $departmentName = trim((string) ($user->department?->name ?? ''));
                if ($departmentName !== '') {
                    $payload['department'] = $departmentName;
                }
            }
        }

        if (is_string($redirectTo) && $redirectTo !== '') {
            $payload['redirect_to'] = $redirectTo;
        }

        return $payload;
    }

    public static function mintLaunchToken(
        User $user,
        Application $application,
        string $ssoEmail,
        ?string $returnTo = null,
        ?string $redirectTo = null,
        int $ttlSeconds = self::LAUNCH_TTL_SECONDS,
    ): string {
        $apiKey = (string) ($application->api_key ?? '');
        if ($apiKey === '') {
            throw new \InvalidArgumentException('System has no api_key configured — cannot sign token.');
        }

        return JWT::encode(
            self::launchPayload($user, $application, $ssoEmail, $returnTo, $redirectTo, $ttlSeconds),
            $apiKey,
            'HS256',
        );
    }

    /**
     * Nexus Campus receives extended primary-email profile claims (full_name, department).
     */
    public static function isCampusApplication(Application $application): bool
    {
        $slugs = config('nexus.sso_campus_slugs', []);
        if (! is_array($slugs) || $slugs === []) {
            return false;
        }

        $target = strtolower(trim((string) $application->slug));
        if ($target === '') {
            return false;
        }

        foreach ($slugs as $slug) {
            if ($target === strtolower(trim((string) $slug))) {
                return true;
            }
        }

        return false;
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
