import { toast } from 'sonner';
import db from '@/api/apiClient';
import {
  spawnExpClaimCelebration,
  spawnExpMoment,
} from '@/components/gamification/ExpClaimCelebration';
import { patchAuthUser } from '@/lib/authUserPatch';
import { queryClientInstance } from '@/lib/query-client';

export const GAMIFICATION_ME_QUERY_KEY = ['gamification-me'];
export const GAMIFICATION_MISSIONS_QUERY_KEY = ['gamification-missions'];

export const EXP_PER_LEVEL = 100;

export const STREAK_LABELS = {
  early_clock_in: 'Early clock-in',
  feed_post: 'Feed post',
};

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftLocalDateString(isoDate, days) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

/** Streak is at risk when last qualified day was yesterday (local calendar). */
export function isStreakAtRisk(streak) {
  const last = streak?.last_qualified_on;
  if (!last || !(Number(streak?.current_count) > 0)) return false;
  const yesterday = shiftLocalDateString(localDateString(), -1);
  return last === yesterday;
}

export function formatStreakCounts(streak) {
  const current = Number(streak?.current_count) || 0;
  const best = Number(streak?.longest_count) || current;
  if (best > current) {
    return `${current}d · best ${best}d`;
  }
  return `${current}d`;
}

/**
 * @param {number} expTotal
 * @returns {{ level: number, exp_into_level: number, exp_for_level: number, progress: number }}
 */
export function levelProgress(expTotal) {
  const exp = Math.max(0, Number(expTotal) || 0);
  const into = exp % EXP_PER_LEVEL;
  return {
    level: Math.floor(exp / EXP_PER_LEVEL) + 1,
    exp_into_level: into,
    exp_for_level: EXP_PER_LEVEL,
    progress: EXP_PER_LEVEL > 0 ? into / EXP_PER_LEVEL : 0,
  };
}

export function extractGamificationOffers(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.gamification_offers) && payload.gamification_offers.length > 0) {
    return payload.gamification_offers;
  }
  if (payload.gamification_offer) {
    return [payload.gamification_offer];
  }
  return [];
}

export function celebrateExpClaim({ amount, count = 1, clientX, clientY, mode } = {}) {
  spawnExpClaimCelebration({
    amount,
    count,
    clientX,
    clientY,
    mode: mode || (count > 1 ? 'all' : 'single'),
  });
}

function celebrateClaimMoments(result) {
  if (!result || typeof result !== 'object') return;

  if (result.leveled_up && result.level) {
    window.setTimeout(() => {
      spawnExpMoment({
        kind: 'level',
        title: `Level ${result.level}`,
        subtitle: 'You leveled up',
      });
    }, 700);
  } else if (result.rank_improved && result.rank != null) {
    window.setTimeout(() => {
      spawnExpMoment({
        kind: 'rank',
        title: `Rank #${result.rank}`,
        subtitle: 'You moved up the board',
      });
    }, 700);
  }

  const milestones = Array.isArray(result.streak_milestones) ? result.streak_milestones : [];
  for (const milestone of milestones) {
    const label = STREAK_LABELS[milestone.streak_key] || milestone.streak_key;
    const days = Number(milestone.current_count) || 0;
    if (days <= 0) continue;
    toast.success(`${days}-day streak`, {
      description: label,
      duration: 5000,
    });
  }

  const badges = Array.isArray(result.new_badges) ? result.new_badges : [];
  for (const badge of badges) {
    toast.success(badge.title || 'Badge unlocked', {
      description: badge.description || 'New achievement',
      duration: 6000,
    });
  }
}

function progressFromClaimResult(result) {
  const expTotal = Number(result?.exp_total);
  if (!Number.isFinite(expTotal)) return null;
  const fallback = levelProgress(expTotal);
  return {
    exp_total: expTotal,
    level: result.level != null ? Number(result.level) : fallback.level,
    exp_into_level: result.exp_into_level != null ? Number(result.exp_into_level) : fallback.exp_into_level,
    exp_for_level: result.exp_for_level != null ? Number(result.exp_for_level) : fallback.exp_for_level,
    progress: result.progress != null ? Number(result.progress) : fallback.progress,
    ...(result.rank != null ? { rank: Number(result.rank) } : {}),
  };
}

function applyClaimResultToCaches(result, { clearPending = false, claimedRewardId = null, claimedAmount = 0 } = {}) {
  const progress = progressFromClaimResult(result);
  if (!progress) return;

  patchAuthUser({ exp_total: progress.exp_total });

  const patchSummary = (current) => {
    if (!current || typeof current !== 'object') return current;
    let next = { ...current, ...progress };

    if (clearPending) {
      next = {
        ...next,
        pending_count: 0,
        pending_amount: 0,
        pending_rewards: [],
      };
    } else if (claimedRewardId != null && Array.isArray(current.pending_rewards)) {
      const pending = current.pending_rewards.filter((reward) => reward.id !== claimedRewardId);
      next = {
        ...next,
        pending_rewards: pending,
        pending_count: pending.length,
        pending_amount: Math.max(0, (Number(current.pending_amount) || 0) - (Number(claimedAmount) || 0)),
      };
    }

    return next;
  };

  queryClientInstance.setQueryData(GAMIFICATION_ME_QUERY_KEY, patchSummary);
  queryClientInstance.setQueryData(GAMIFICATION_MISSIONS_QUERY_KEY, patchSummary);
}

function invalidateGamificationQueries() {
  queryClientInstance.invalidateQueries({ queryKey: GAMIFICATION_ME_QUERY_KEY });
  queryClientInstance.invalidateQueries({ queryKey: GAMIFICATION_MISSIONS_QUERY_KEY });
  queryClientInstance.invalidateQueries({ queryKey: ['gamification-leaderboard'] });
}

export async function claimGamificationReward(rewardId, { clientX, clientY } = {}) {
  const result = await db.gamification.claim(rewardId);
  applyClaimResultToCaches(result, {
    claimedRewardId: rewardId,
    claimedAmount: Number(result?.reward?.amount) || 0,
  });
  invalidateGamificationQueries();
  const amount = Number(result?.reward?.amount) || 0;
  celebrateExpClaim({ amount, clientX, clientY, mode: 'single' });
  celebrateClaimMoments(result);
  return result;
}

export async function claimAllGamificationRewards({ clientX, clientY } = {}) {
  const result = await db.gamification.claimAll();
  const amount = Number(result?.claimed_amount) || 0;
  const count = Number(result?.claimed_count) || 0;
  if (count > 0) {
    applyClaimResultToCaches(result, { clearPending: true });
  }
  invalidateGamificationQueries();
  if (count > 0) {
    celebrateExpClaim({ amount, count, clientX, clientY, mode: 'all' });
    celebrateClaimMoments(result);
  } else {
    toast.message('No pending rewards');
  }
  return result;
}

export function notifyGamificationOffers(payload) {
  const offers = extractGamificationOffers(payload);
  if (offers.length === 0) return;

  queryClientInstance.invalidateQueries({ queryKey: GAMIFICATION_ME_QUERY_KEY });
  queryClientInstance.invalidateQueries({ queryKey: GAMIFICATION_MISSIONS_QUERY_KEY });

  for (const offer of offers) {
    const offerAmount = Number(offer?.amount) || 0;
    const title = offer?.title || 'Reward';
    toast.message(`+${offerAmount} EXP`, {
      description: title,
      action: {
        label: 'Claim',
        onClick: (event) => {
          const clientX = event?.clientX;
          const clientY = event?.clientY;
          claimGamificationReward(offer.id, { clientX, clientY }).catch((error) => {
            toast.error(error?.data?.message || error.message || 'Failed to claim EXP');
          });
        },
      },
      duration: 8000,
    });
  }
}
