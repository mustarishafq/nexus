// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import PageLoader from '@/components/PageLoader';
import { GlassCard } from '@/components/games/GameUi';
import { glassDialogMutedText, glassDialogTitleText } from '@/components/layout/glassStyles';
import { useAuth } from '@/lib/AuthContext';
import { can } from '@/lib/roles';
import { cn } from '@/lib/utils';

const FIELDS = [
  { key: 'rank_1', label: '1st place' },
  { key: 'rank_2', label: '2nd place' },
  { key: 'rank_3', label: '3rd place' },
  { key: 'rank_4_to_10', label: 'Ranks 4–10' },
  { key: 'rank_11_plus', label: 'Everyone else (11+)' },
];

function coerceEnabled(value) {
  if (value === false || value === 0 || value === '0' || value === 'false' || value === 'off') return false;
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on') return true;
  return true;
}

function toForm(payload) {
  return {
    live_exp_enabled: coerceEnabled(payload?.live_exp_enabled),
    rank_1: payload?.rank_1 ?? 20,
    rank_2: payload?.rank_2 ?? 15,
    rank_3: payload?.rank_3 ?? 10,
    rank_4_to_10: payload?.rank_4_to_10 ?? 5,
    rank_11_plus: payload?.rank_11_plus ?? 2,
  };
}

export default function QuizGameSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(toForm());
  const hydratedRef = useRef(false);

  const settingsQuery = useQuery({
    queryKey: ['quiz-game-settings'],
    queryFn: () => db.quizzes.gameSettings(),
    enabled: can(user, 'quiz.manage'),
  });

  useEffect(() => {
    if (settingsQuery.data && !hydratedRef.current) {
      setForm(toForm(settingsQuery.data));
      hydratedRef.current = true;
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => db.quizzes.updateGameSettings({
      live_exp_enabled: form.live_exp_enabled ? 1 : 0,
      rank_1: Number(form.rank_1),
      rank_2: Number(form.rank_2),
      rank_3: Number(form.rank_3),
      rank_4_to_10: Number(form.rank_4_to_10),
      rank_11_plus: Number(form.rank_11_plus),
    }),
    onSuccess: (payload) => {
      queryClient.setQueryData(['quiz-game-settings'], payload);
      setForm(toForm(payload));
      toast.success('Games settings saved');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not save settings'),
  });

  if (!can(user, 'quiz.manage')) {
    return <Navigate to="/games" replace />;
  }

  if (settingsQuery.isLoading) return <PageLoader />;

  const defaults = settingsQuery.data?.defaults || toForm();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/games"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className={cn('text-xl font-bold tracking-tight', glassDialogTitleText)}>Games settings</h1>
          <p className={cn('text-sm', glassDialogMutedText)}>
            Live host EXP only. Published / self-paced quizzes never award quiz EXP.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="shadow-md shadow-primary/20"
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>

      <GlassCard className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="live-exp-enabled">Award EXP for live games</Label>
            <p className={cn('text-xs mt-1', glassDialogMutedText)}>
              Players who finish a live game receive EXP by final rank. Turn this off to award none.
            </p>
          </div>
          <Switch
            id="live-exp-enabled"
            checked={!!form.live_exp_enabled}
            onCheckedChange={(live_exp_enabled) => setForm((prev) => ({ ...prev, live_exp_enabled }))}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label className="text-xs">{field.label}</Label>
              <Input
                type="number"
                min={0}
                max={10000}
                disabled={!form.live_exp_enabled}
                value={form[field.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
              <p className={cn('text-[11px]', glassDialogMutedText)}>
                Default {defaults[field.key]} EXP
              </p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
