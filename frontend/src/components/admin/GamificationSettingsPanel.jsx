import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function buildOverridesFromActions(actions) {
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
  return { actions: overrides };
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

  const updateAction = (actionKey, patch) => {
    onChange((current) => {
      const currentActions = Array.isArray(current?.gamification?.actions)
        ? current.gamification.actions
        : actions;
      const nextActions = currentActions.map((row) => (
        row.action_key === actionKey ? { ...row, ...patch } : row
      ));
      const gamification_overrides = buildOverridesFromActions(nextActions);
      return {
        ...current,
        gamification: { ...(current.gamification || {}), actions: nextActions },
        gamification_overrides,
      };
    });
  };

  const resetAction = (actionKey) => {
    const row = actions.find((item) => item.action_key === actionKey);
    if (!row) return;
    updateAction(actionKey, {
      base: row.default_base,
      daily_cap: row.default_daily_cap,
    });
  };

  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Gamification catalog will appear after settings load.
      </p>
    );
  }

  return (
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
  );
}
