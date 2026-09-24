import db from '@/api/apiClient';
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import AdminSettingsToggleRow from '@/components/admin/AdminSettingsToggleRow';
import { toast } from 'sonner';

const DEFAULT_CLOCK_RULES = {
  allow_outside_shift_hours: false,
  require_early_clock_out_reason: false,
  require_late_clock_in_reason: false,
  overtime_enabled: true,
  overtime_threshold_minutes: 0,
  grace_period_minutes: 15,
  allow_different_shift_clock_in: false,
  shortage_enabled: true,
  count_work_from_scheduled_start: true,
};

function normalizeClockRules(input = {}) {
  return {
    allow_outside_shift_hours: Boolean(input.allow_outside_shift_hours),
    require_early_clock_out_reason: Boolean(input.require_early_clock_out_reason),
    require_late_clock_in_reason: Boolean(input.require_late_clock_in_reason),
    overtime_enabled: input.overtime_enabled !== false,
    overtime_threshold_minutes: Number(input.overtime_threshold_minutes ?? 0),
    grace_period_minutes: Number(input.grace_period_minutes ?? 15),
    allow_different_shift_clock_in: Boolean(input.allow_different_shift_clock_in),
    shortage_enabled: input.shortage_enabled !== false,
    count_work_from_scheduled_start: input.count_work_from_scheduled_start !== false,
  };
}

const toggleClass = 'h-full p-3';

export default function AttendanceClockRulesPanel({ peerHint = 'Insan' }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULT_CLOCK_RULES);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-clock-rules'],
    queryFn: () => db.attendanceClockRules.get(),
  });

  useEffect(() => {
    if (data?.settings) {
      setForm(normalizeClockRules(data.settings));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => db.attendanceClockRules.update(form),
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-clock-rules'] });
      queryClient.invalidateQueries({ queryKey: ['department-attendance-settings'] });
      if (payload?.settings) {
        setForm(normalizeClockRules(payload.settings));
      }
      toast.success(`Company clock rules saved — syncing to ${peerHint}`);
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to save clock rules');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">Exceptions</CardTitle>
            <CardDescription>
              When staff may clock outside the shift window, and when reasons are required.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="min-h-[40px] shrink-0 gap-2"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save company rules
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminSettingsToggleRow
              className={toggleClass}
              label={<Label>Allow outside shift hours</Label>}
              description="Clock in or out outside the shift window, with a warning"
            >
              <Switch
                checked={form.allow_outside_shift_hours}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_outside_shift_hours: checked }))}
              />
            </AdminSettingsToggleRow>

            <AdminSettingsToggleRow
              className={toggleClass}
              label={<Label>Allow different-shift clock-in</Label>}
              description="Rostered on one shift, clocks another — confirm first"
            >
              <Switch
                checked={form.allow_different_shift_clock_in}
                onCheckedChange={(checked) => setForm((current) => ({
                  ...current,
                  allow_different_shift_clock_in: checked,
                }))}
              />
            </AdminSettingsToggleRow>

            <AdminSettingsToggleRow
              className={toggleClass}
              label={<Label>Require early clock-out reason</Label>}
              description="Ask when clock-out is before shift end minus grace"
            >
              <Switch
                checked={form.require_early_clock_out_reason}
                onCheckedChange={(checked) => setForm((current) => ({
                  ...current,
                  require_early_clock_out_reason: checked,
                }))}
              />
            </AdminSettingsToggleRow>

            <AdminSettingsToggleRow
              className={toggleClass}
              label={<Label>Require late clock-in reason</Label>}
              description="Ask when clock-in is after start plus grace"
            >
              <Switch
                checked={form.require_late_clock_in_reason}
                onCheckedChange={(checked) => setForm((current) => ({
                  ...current,
                  require_late_clock_in_reason: checked,
                }))}
              />
            </AdminSettingsToggleRow>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Time tracking</CardTitle>
          <CardDescription>
            Overtime and short hours use each shift’s hours (end − start − unpaid break).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminSettingsToggleRow
              className={toggleClass}
              label={<Label>Track overtime</Label>}
              description="Count time beyond the assigned shift as overtime"
            >
              <Switch
                checked={form.overtime_enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, overtime_enabled: checked }))}
              />
            </AdminSettingsToggleRow>

            <AdminSettingsToggleRow
              className={toggleClass}
              label={<Label>Track short hours</Label>}
              description="Flag days where payable time is below the shift window minus unpaid break"
            >
              <Switch
                checked={form.shortage_enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, shortage_enabled: checked }))}
              />
            </AdminSettingsToggleRow>

            <AdminSettingsToggleRow
              className={toggleClass}
              label={<Label>Count work time from shift start</Label>}
              description="If staff clock in early, worked time still starts at the shift start"
            >
              <Switch
                checked={form.count_work_from_scheduled_start}
                onCheckedChange={(checked) => setForm((current) => ({
                  ...current,
                  count_work_from_scheduled_start: checked,
                }))}
              />
            </AdminSettingsToggleRow>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {form.overtime_enabled ? (
              <div className="space-y-1.5">
                <Label>OT threshold (min)</Label>
                <Input
                  type="number"
                  min={0}
                  max={480}
                  className="tabular-nums"
                  value={form.overtime_threshold_minutes}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    overtime_threshold_minutes: Number(event.target.value || 0),
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Extra minutes beyond the shift before overtime starts.
                </p>
              </div>
            ) : (
              <div className="hidden sm:block" aria-hidden />
            )}
            <div className="space-y-1.5">
              <Label>Grace period (min)</Label>
              <Input
                type="number"
                min={0}
                max={180}
                className="tabular-nums"
                value={form.grace_period_minutes}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  grace_period_minutes: Number(event.target.value || 0),
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Minutes after shift start before late, and before shift end before early.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
