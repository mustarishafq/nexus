import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_EARLY_CLOCK_IN_WINDOW_MINUTES = 60;
const DEFAULT_EARLY_CLOCK_IN_CUTOFF_MINUTES = 0;

function clampMinutes(value, fallback) {
  if (!Number.isFinite(Number(value))) return fallback;
  return Math.max(0, Math.min(240, Number(value)));
}

function buildOverrides(actions, earlyWindowMinutes, earlyCutoffMinutes, defaults) {
  const overrides = {};
  for (const row of actions) {
    const patch = {};
    if (Number(row.base) !== Number(row.default_base)) {
      patch.base = Number(row.base);
    }
    const cap = row.daily_cap === '' || row.daily_cap === undefined ? null : row.daily_cap;
    const defaultCap = row.default_daily_cap ?? null;
    if (cap !== defaultCap) {
      patch.daily_cap = cap === null ? null : Number(cap);
    }
    if (Object.keys(patch).length > 0) {
      overrides[row.action_key] = patch;
    }
  }

  const windowValue = clampMinutes(earlyWindowMinutes, defaults.window);
  const cutoffValue = Math.min(
    clampMinutes(earlyCutoffMinutes, defaults.cutoff),
    windowValue,
  );

  return {
    actions: overrides,
    early_clock_in_window_minutes: windowValue,
    early_clock_in_cutoff_minutes: cutoffValue,
  };
}

export default function GamificationSettingsPanel({ settings, onChange }) {
  const actions = useMemo(() => {
    const fromPayload = Array.isArray(settings?.gamification?.actions)
      ? settings.gamification.actions
      : [];
    if (fromPayload.length > 0) return fromPayload;

    // Fallback: reconstruct from overrides only (should be rare).
    return [];
  }, [settings?.gamification?.actions]);

  const defaultEarlyWindow = Number(
    settings?.gamification?.default_early_clock_in_window_minutes
      ?? DEFAULT_EARLY_CLOCK_IN_WINDOW_MINUTES,
  );
  const defaultEarlyCutoff = Number(
    settings?.gamification?.default_early_clock_in_cutoff_minutes
      ?? DEFAULT_EARLY_CLOCK_IN_CUTOFF_MINUTES,
  );
  const earlyWindow = Number(
    settings?.gamification?.early_clock_in_window_minutes
      ?? settings?.gamification_overrides?.early_clock_in_window_minutes
      ?? defaultEarlyWindow,
  );
  const earlyCutoff = Number(
    settings?.gamification?.early_clock_in_cutoff_minutes
      ?? settings?.gamification_overrides?.early_clock_in_cutoff_minutes
      ?? defaultEarlyCutoff,
  );

  const commit = (nextActions, nextEarlyWindow, nextEarlyCutoff) => {
    onChange((current) => {
      const gamification_overrides = buildOverrides(
        nextActions,
        nextEarlyWindow,
        nextEarlyCutoff,
        { window: defaultEarlyWindow, cutoff: defaultEarlyCutoff },
      );
      return {
        ...current,
        gamification: {
          ...(current.gamification || {}),
          actions: nextActions,
          early_clock_in_window_minutes: gamification_overrides.early_clock_in_window_minutes,
          default_early_clock_in_window_minutes: defaultEarlyWindow,
          early_clock_in_cutoff_minutes: gamification_overrides.early_clock_in_cutoff_minutes,
          default_early_clock_in_cutoff_minutes: defaultEarlyCutoff,
        },
        gamification_overrides,
      };
    });
  };

  const updateAction = (actionKey, patch) => {
    const currentActions = Array.isArray(settings?.gamification?.actions)
      ? settings.gamification.actions
      : actions;
    const nextActions = currentActions.map((row) => (
      row.action_key === actionKey ? { ...row, ...patch } : row
    ));
    commit(nextActions, earlyWindow, earlyCutoff);
  };

  const resetAction = (actionKey) => {
    const row = actions.find((item) => item.action_key === actionKey);
    if (!row) return;
    updateAction(actionKey, {
      base: row.default_base,
      daily_cap: row.default_daily_cap,
    });
  };

  const updateEarlyWindow = (value) => {
    const next = value === '' ? 0 : Number(value);
    commit(actions, Number.isFinite(next) ? next : defaultEarlyWindow, earlyCutoff);
  };

  const updateEarlyCutoff = (value) => {
    const next = value === '' ? 0 : Number(value);
    commit(actions, earlyWindow, Number.isFinite(next) ? next : defaultEarlyCutoff);
  };

  const resetEarlyWindow = () => {
    commit(actions, defaultEarlyWindow, earlyCutoff);
  };

  const resetEarlyCutoff = () => {
    commit(actions, earlyWindow, defaultEarlyCutoff);
  };

  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Gamification catalog will appear after settings load.
      </p>
    );
  }

  const earlyWindowDirty = Number(earlyWindow) !== Number(defaultEarlyWindow);
  const earlyCutoffDirty = Number(earlyCutoff) !== Number(defaultEarlyCutoff);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="early-clock-in-window">Early clock-in starts (min before shift)</Label>
              <p className="text-[11px] text-muted-foreground">
                Earliest clock-in that can still earn Early clock-in EXP.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!earlyWindowDirty}
              title="Reset to default"
              onClick={resetEarlyWindow}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            id="early-clock-in-window"
            type="number"
            min={0}
            max={240}
            value={earlyWindow}
            onChange={(event) => updateEarlyWindow(event.target.value)}
            className="h-9 max-w-[10rem]"
          />
          <p className="text-[10px] text-muted-foreground">Default {defaultEarlyWindow}</p>
        </div>

        <div className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="early-clock-in-cutoff">Early clock-in ends (min before shift)</Label>
              <p className="text-[11px] text-muted-foreground">
                Stop offering Early clock-in EXP this many minutes before shift start. 0 = until on time (grace).
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!earlyCutoffDirty}
              title="Reset to default"
              onClick={resetEarlyCutoff}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            id="early-clock-in-cutoff"
            type="number"
            min={0}
            max={240}
            value={earlyCutoff}
            onChange={(event) => updateEarlyCutoff(event.target.value)}
            className="h-9 max-w-[10rem]"
          />
          <p className="text-[10px] text-muted-foreground">Default {defaultEarlyCutoff}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Override base EXP and daily caps. Leave daily cap blank for unlimited.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold w-28">Base EXP</th>
                <th className="px-3 py-2 font-semibold w-32">Daily cap</th>
                <th className="px-3 py-2 font-semibold w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {actions.map((row) => {
                const dirty = Number(row.base) !== Number(row.default_base)
                  || (row.daily_cap ?? null) !== (row.default_daily_cap ?? null);
                return (
                  <tr key={row.action_key} className="align-top">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{row.title}</p>
                      <p className="text-[11px] text-muted-foreground">{row.action_key}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Label className="sr-only" htmlFor={`exp-base-${row.action_key}`}>Base</Label>
                      <Input
                        id={`exp-base-${row.action_key}`}
                        type="number"
                        min={0}
                        max={10000}
                        value={row.base}
                        onChange={(event) => updateAction(row.action_key, {
                          base: Number(event.target.value),
                        })}
                        className="h-9"
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">Default {row.default_base}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Label className="sr-only" htmlFor={`exp-cap-${row.action_key}`}>Cap</Label>
                      <Input
                        id={`exp-cap-${row.action_key}`}
                        type="number"
                        min={0}
                        max={10000}
                        placeholder="∞"
                        value={row.daily_cap ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateAction(row.action_key, {
                            daily_cap: value === '' ? null : Number(value),
                          });
                        }}
                        className="h-9"
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Default {row.default_daily_cap == null ? '∞' : row.default_daily_cap}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        disabled={!dirty}
                        title="Reset to default"
                        onClick={() => resetAction(row.action_key)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
