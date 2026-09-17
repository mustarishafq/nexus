<?php

namespace App\Services\GeneralChat;

use App\Exceptions\GeneralChatQuotaExceededException;
use App\Models\GeneralChatTokenGrant;
use App\Models\LlmUsageLog;
use App\Models\User;
use App\Support\GeneralChatSettings;

class GeneralChatQuotaService
{
    /**
     * @return array{
     *     used: int,
     *     remaining: int,
     *     base_limit: int,
     *     inherited_limit: int,
     *     individual_limit: int|null,
     *     grant_tokens: int,
     *     effective_limit: int,
     *     period: string,
     *     period_starts_at: string,
     *     resets_at: string,
     *     blocked: bool
     * }
     */
    public function snapshot(User $user): array
    {
        $settings = GeneralChatSettings::normalize();
        [$startsAt, $resetsAt] = GeneralChatSettings::currentWindow();

        $inherited = $settings['token_limit'];
        $individual = $user->general_chat_token_limit;
        $individual = $individual === null ? null : max(0, (int) $individual);
        $base = $individual ?? $inherited;

        $used = (int) LlmUsageLog::query()
            ->where('user_id', $user->id)
            ->where('feature', GeneralChatSettings::FEATURE)
            ->where('created_at', '>=', $startsAt)
            ->where('created_at', '<', $resetsAt)
            ->sum('total_tokens');

        $grants = (int) GeneralChatTokenGrant::query()
            ->where('user_id', $user->id)
            ->where('period_starts_at', $startsAt)
            ->sum('tokens');

        $effective = $base + $grants;
        $remaining = max(0, $effective - $used);

        return [
            'used' => $used,
            'remaining' => $remaining,
            'base_limit' => $base,
            'inherited_limit' => $inherited,
            'individual_limit' => $individual,
            'grant_tokens' => $grants,
            'effective_limit' => $effective,
            'period' => $settings['reset_period'],
            'period_starts_at' => $startsAt->toIso8601String(),
            'resets_at' => $resetsAt->toIso8601String(),
            'blocked' => $remaining <= 0,
        ];
    }

    public function assertCanSpend(User $user): array
    {
        $snapshot = $this->snapshot($user);

        if ($snapshot['blocked']) {
            throw new GeneralChatQuotaExceededException($snapshot);
        }

        return $snapshot;
    }

    public function grant(User $user, int $tokens, ?User $actor = null, ?string $note = null): GeneralChatTokenGrant
    {
        [$startsAt] = GeneralChatSettings::currentWindow();

        return GeneralChatTokenGrant::query()->create([
            'user_id' => $user->id,
            'tokens' => max(1, $tokens),
            'period_starts_at' => $startsAt,
            'note' => $note !== null && trim($note) !== '' ? mb_substr(trim($note), 0, 500) : null,
            'created_by' => $actor?->id,
        ]);
    }
}
