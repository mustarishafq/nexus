import db from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPin, Plus, Save, Trash2, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  DEFAULT_SHIFT,
  departmentAttendanceSettingsToPayload,
  normalizeDepartmentAttendanceSettings,
  WEEKDAYS,
} from '@/lib/attendancePolicy';
import { toast } from 'sonner';

function ShiftEditor({ shift, index, onChange, onRemove, canRemove }) {
  const toggleDay = (day) => {
    const days = new Set(shift.days_of_week || []);
    if (days.has(day)) {
      days.delete(day);
    } else {
      days.add(day);
    }
    onChange(index, { ...shift, days_of_week: Array.from(days).sort((a, b) => a - b) });
  };

  return (
    <div className="rounded-xl border p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Shift name</Label>
            <Input
              value={shift.name}
              onChange={(event) => onChange(index, { ...shift, name: event.target.value })}
              placeholder="Day Shift"
            />
          </div>
          <div className="space-y-2">
            <Label>Start time</Label>
            <Input
              type="time"
              value={shift.start_time}
              onChange={(event) => onChange(index, { ...shift, start_time: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>End time</Label>
            <Input
              type="time"
              value={shift.end_time}
              onChange={(event) => onChange(index, { ...shift, end_time: event.target.value })}
            />
          </div>
        </div>
        {canRemove ? (
          <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Working days</Label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <Checkbox
                checked={shift.days_of_week?.includes(day.value)}
                onCheckedChange={() => toggleDay(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div>
          <Label>Crosses midnight</Label>
          <p className="text-xs text-muted-foreground">Enable for night shifts that end the next day.</p>
        </div>
        <Switch
          checked={Boolean(shift.crosses_midnight)}
          onCheckedChange={(checked) => onChange(index, { ...shift, crosses_midnight: checked })}
        />
      </div>
    </div>
  );
}

export default function DepartmentAttendancePolicyPanel() {
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState('');
  const [form, setForm] = useState(normalizeDepartmentAttendanceSettings());

  const { data, isLoading } = useQuery({
    queryKey: ['department-attendance-settings'],
    queryFn: () => db.departmentAttendance.list(),
  });

  const departments = data?.departments || [];

  useEffect(() => {
    if (!departmentId && departments.length) {
      setDepartmentId(String(departments[0].department.id));
    }
  }, [departmentId, departments]);

  useEffect(() => {
    const entry = departments.find((item) => String(item.department.id) === departmentId);
    if (entry) {
      setForm(normalizeDepartmentAttendanceSettings(entry.settings));
    }
  }, [departmentId, departments]);

  const saveMutation = useMutation({
    mutationFn: () => db.departmentAttendance.update(departmentId, departmentAttendanceSettingsToPayload(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-attendance-settings'] });
      toast.success('Department attendance policy saved');
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to save attendance policy');
    },
  });

  const selectedDepartment = useMemo(
    () => departments.find((item) => String(item.department.id) === departmentId)?.department,
    [departments, departmentId],
  );

  const updateShift = (index, nextShift) => {
    setForm((current) => ({
      ...current,
      shifts: current.shifts.map((shift, shiftIndex) => (shiftIndex === index ? nextShift : shift)),
    }));
  };

  const addShift = () => {
    setForm((current) => ({
      ...current,
      shifts: [...current.shifts, { ...DEFAULT_SHIFT, name: `Shift ${current.shifts.length + 1}` }],
    }));
  };

  const removeShift = (index) => {
    setForm((current) => ({
      ...current,
      shifts: current.shifts.filter((_, shiftIndex) => shiftIndex !== index),
    }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not available in this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          center_latitude: position.coords.latitude.toFixed(7),
          center_longitude: position.coords.longitude.toFixed(7),
          geofence_enabled: true,
        }));
        toast.success('Current location applied');
      },
      () => toast.error('Unable to get current location'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <Label>Department</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((entry) => (
                <SelectItem key={entry.department.id} value={String(entry.department.id)}>
                  {entry.department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDepartment ? (
            <p className="text-xs text-muted-foreground">
              Rules apply to users assigned to {selectedDepartment.name}.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!departmentId || saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save policy
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-xl border px-4 py-3">
        <div>
          <Label>Enable rules for this department</Label>
          <p className="text-xs text-muted-foreground">When disabled, users in this department are not restricted.</p>
        </div>
        <Switch
          checked={form.enabled}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
        />
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Location radius
          </CardTitle>
          <CardDescription>Require users to clock in/out within a radius of the assigned site.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label>Enable geofence</Label>
            <Switch
              checked={form.geofence_enabled}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, geofence_enabled: checked }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Center latitude</Label>
              <Input
                value={form.center_latitude}
                onChange={(event) => setForm((current) => ({ ...current, center_latitude: event.target.value }))}
                placeholder="3.1390"
              />
            </div>
            <div className="space-y-2">
              <Label>Center longitude</Label>
              <Input
                value={form.center_longitude}
                onChange={(event) => setForm((current) => ({ ...current, center_longitude: event.target.value }))}
                placeholder="101.6869"
              />
            </div>
          </div>

          <Button type="button" variant="outline" onClick={useCurrentLocation} className="gap-2">
            <MapPin className="h-4 w-4" />
            Use my current location
          </Button>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Allowed radius</Label>
              <span className="text-sm font-medium tabular-nums">{form.radius_meters} m</span>
            </div>
            <Slider
              min={50}
              max={5000}
              step={50}
              value={[form.radius_meters]}
              onValueChange={([value]) => setForm((current) => ({ ...current, radius_meters: value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <Label>Allow outside radius</Label>
              <p className="text-xs text-muted-foreground">Record attendance but flag it when outside the radius.</p>
            </div>
            <Switch
              checked={form.allow_outside_radius}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_outside_radius: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-primary" />
            Working hours & shifts
          </CardTitle>
          <CardDescription>Define one or more shifts per department, including night shifts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={form.timezone}
                onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                placeholder="Asia/Kuala_Lumpur"
              />
            </div>
            <div className="space-y-2">
              <Label>Grace period (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={180}
                value={form.grace_period_minutes}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  grace_period_minutes: Number(event.target.value || 0),
                }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <Label>Allow outside shift hours</Label>
              <p className="text-xs text-muted-foreground">Flag attendance recorded outside scheduled shifts.</p>
            </div>
            <Switch
              checked={form.allow_outside_shift_hours}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_outside_shift_hours: checked }))}
            />
          </div>

          <div className="space-y-3">
            {form.shifts.map((shift, index) => (
              <ShiftEditor
                key={`${shift.name}-${index}`}
                shift={shift}
                index={index}
                onChange={updateShift}
                onRemove={removeShift}
                canRemove={form.shifts.length > 1}
              />
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addShift} className="gap-2">
            <Plus className="h-4 w-4" />
            Add shift
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overtime</CardTitle>
          <CardDescription>Calculate overtime when users clock out after their standard day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label>Track overtime</Label>
            <Switch
              checked={form.overtime_enabled}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, overtime_enabled: checked }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Standard hours per day</Label>
              <Input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={form.standard_hours_per_day}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  standard_hours_per_day: Number(event.target.value || 8),
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Overtime threshold (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={480}
                value={form.overtime_threshold_minutes}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  overtime_threshold_minutes: Number(event.target.value || 0),
                }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
