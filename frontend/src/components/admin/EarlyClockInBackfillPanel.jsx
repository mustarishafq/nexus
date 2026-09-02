import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Eye, RefreshCw } from 'lucide-react';
import db from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function todayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatClockIn(value) {
  if (!value) return '—';
  const [date, time] = String(value).split(' ');
  return time ? `${date} ${time.slice(0, 5)}` : date;
}

function streakCopy(item) {
  if (item.streak_skipped) {
    const later = item.last_qualified_on ? ` (already ${item.previous_streak || 0}-day on ${item.last_qualified_on})` : '';
    return `No streak bonus${later}`;
  }
  const count = Number(item.streak_count) || 1;
  const already = String(item.status || '').startsWith('already_');
  if (count <= 1) {
    return already ? '1-day streak' : 'Starts 1-day streak';
  }
  return `${count}-day streak`;
}

function statusCopy(status) {
  switch (status) {
    case 'would_pending':
      return 'Would be pending';
    case 'would_claimed':
      return 'Would claim now';
    case 'pending':
      return 'Pending';
    case 'claimed':
      return 'Claimed';
    case 'already_pending':
      return 'Already pending';
    case 'already_claimed':
      return 'Already claimed';
    default:
      return status || '—';
  }
}

function isNewItem(item) {
  const status = String(item.status || '');
  return status.startsWith('would_') || status === 'pending' || status === 'claimed';
}

const RESULT_FILTERS = [
  { id: 'all', label: 'All qualifying' },
  { id: 'new', label: 'Needs offer' },
  { id: 'already', label: 'Already granted' },
];

export default function EarlyClockInBackfillPanel({ windowMinutes, cutoffMinutes }) {
  const [date, setDate] = useState(todayYmd);
  const [dateTo, setDateTo] = useState('');
  const [user, setUser] = useState('');
  const [status, setStatus] = useState('pending');
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [listFilter, setListFilter] = useState('all');
  const [listQuery, setListQuery] = useState('');

  const payload = useMemo(() => ({
    date,
    date_to: dateTo || undefined,
    user: user.trim() || undefined,
    status,
  }), [date, dateTo, user, status]);

  const visibleItems = useMemo(() => {
    const items = Array.isArray(result?.items) ? result.items : [];
    const query = listQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (listFilter === 'new' && !isNewItem(item)) return false;
      if (listFilter === 'already' && isNewItem(item)) return false;
      if (!query) return true;
      return [item.name, item.email, item.mission, item.title, item.action_key].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [result, listFilter, listQuery]);

  const run = async (dryRun) => {
    if (!date) {
      toast.error('Choose a start date.');
      return;
    }

    setBusy(dryRun ? 'preview' : 'run');
    try {
      const stats = await db.backfillEarlyClockInExp({
        ...payload,
        dry_run: dryRun,
      });
      setResult(stats);
      setListFilter('all');
      const granted = Number(stats.already_granted || 0);
      if (dryRun) {
        toast.success(`Would offer ${stats.offered} new · ${granted} already granted.`);
      } else {
        const verb = stats.status === 'claimed' ? 'Claimed' : 'Offered';
        toast.success(`${verb} ${stats.offered} new · ${granted} already granted left alone.`);
      }
    } catch (error) {
      toast.error(error?.message || 'Could not recalculate Early clock-in EXP.');
    } finally {
      setBusy(null);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        After you change the early window, save Settings, then rerun this for the days that should
        have qualified. Saved window is {windowMinutes} min (cutoff {cutoffMinutes}). Uses department
        shifts, not live special-release pins.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="early-backfill-from">From</Label>
          <Input
            id="early-backfill-from"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="early-backfill-to">To (optional)</Label>
          <Input
            id="early-backfill-to"
            type="date"
            value={dateTo}
            min={date || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="early-backfill-user">User id or email (optional)</Label>
          <Input
            id="early-backfill-user"
            value={user}
            onChange={(event) => setUser(event.target.value)}
            placeholder="All users"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="early-backfill-status">Reward status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="early-backfill-status" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending — people claim from Missions</SelectItem>
              <SelectItem value="claimed">Claimed — add EXP immediately</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={Boolean(busy)}
          onClick={() => run(true)}
        >
          <Eye className="h-4 w-4" />
          {busy === 'preview' ? 'Previewing...' : 'Preview'}
        </Button>
        <Button
          type="button"
          className="gap-2"
          disabled={Boolean(busy)}
          onClick={() => setConfirmOpen(true)}
        >
          <RefreshCw className="h-4 w-4" />
          Recalculate
        </Button>
      </div>

      {result ? (
        <div className="space-y-3">
          <p className="text-sm">
            {result.dry_run ? 'Preview' : 'Done'}: {result.offered} {result.dry_run ? 'need an offer' : result.status}
            {' · '}
            {result.already_granted || 0} already granted
            {' · '}
            {result.ineligible} ineligible (late / no shift)
            {' · '}
            {result.scanned} clock-ins scanned
            {' · '}
            window {result.window_minutes} min
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
              {RESULT_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setListFilter(item.id)}
                  className={cn(
                    'min-h-[32px] rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    listFilter === item.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Input
              value={listQuery}
              onChange={(event) => setListQuery(event.target.value)}
              placeholder="Filter by name or email"
              className="h-9 sm:max-w-xs"
            />
          </div>
          {visibleItems.length ? (
            <div className="max-h-[28rem] overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="sticky top-0 bg-muted/90 text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Person</th>
                    <th className="px-3 py-2 font-semibold">Mission</th>
                    <th className="px-3 py-2 font-semibold">Clock-in</th>
                    <th className="px-3 py-2 font-semibold">EXP</th>
                    <th className="px-3 py-2 font-semibold">Streak</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {visibleItems.map((item) => (
                    <tr key={`${item.record_id}-${item.user_id}`}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{item.name || item.email}</p>
                        <p className="text-[11px] text-muted-foreground">{item.email}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{item.title || item.mission || 'Early clock in'}</p>
                        <p className="text-[11px] text-muted-foreground">{item.action_key || 'clock_in_early'}</p>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {formatClockIn(item.captured_at)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <p className="font-medium">+{item.amount ?? 0}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.streak_bonus > 0
                            ? `base ${item.base} + ${item.streak_bonus} streak`
                            : `base ${item.base ?? item.amount ?? 0}`}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{streakCopy(item)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.streak_skipped
                            ? 'Later early days stay intact'
                            : `Longest ${item.longest_streak || item.streak_count || 1}`}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                        {statusCopy(item.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {listQuery || listFilter !== 'all'
                ? 'No matching rows in this filter.'
                : 'Nobody qualifies in this range.'}
            </p>
          )}
          {(Number(result.offered) + Number(result.already_granted || 0)) > (result.items?.length || 0) ? (
            <p className="text-[11px] text-muted-foreground">
              Showing the first {result.items.length} qualifying clock-ins.
            </p>
          ) : null}
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recalculate Early clock-in EXP?</AlertDialogTitle>
            <AlertDialogDescription>
              {status === 'claimed'
                ? 'Eligible missed rewards will be created and claimed immediately, so EXP totals update now.'
                : 'Eligible missed rewards will be offered as pending. People claim them from Missions.'}
              {' '}
              Already-granted Early clock-in rewards are left alone. Save the window first if you just changed it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busy)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(busy)}
              onClick={(event) => {
                event.preventDefault();
                run(false);
              }}
            >
              {busy === 'run' ? 'Recalculating...' : 'Recalculate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
