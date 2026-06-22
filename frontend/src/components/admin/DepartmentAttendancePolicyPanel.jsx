import db from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Loader2, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  DEFAULT_SHIFT,
  departmentAttendanceSettingsToPayload,
  normalizeDepartmentAttendanceSettings,
  WEEKDAYS,
} from '@/lib/attendancePolicy';
import AdminSettingsToggleRow from '@/components/admin/AdminSettingsToggleRow';
import AdminSettingsToolbar, { adminSettingsToolbarButtonClassName } from '@/components/admin/AdminSettingsToolbar';
import TimezoneSelect from '@/components/admin/TimezoneSelect';
import { cn } from '@/lib/utils';
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
    <div className="rounded-xl border bg-muted/10 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs">Shift name</Label>
            <Input
              value={shift.name}
              onChange={(event) => onChange(index, { ...shift, name: event.target.value })}
              placeholder="Day Shift"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Start</Label>
            <Input
              type="time"
              value={shift.start_time}
              onChange={(event) => onChange(index, { ...shift, start_time: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">End</Label>
            <Input
              type="time"
              value={shift.end_time}
              onChange={(event) => onChange(index, { ...shift, end_time: event.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <AdminSettingsToggleRow
              className="p-3"
              label={<Label className="text-xs">Crosses midnight</Label>}
              description="Enable for night shifts that end after midnight, e.g. 22:00–06:00."
            >
              <Switch
                checked={Boolean(shift.crosses_midnight)}
                onCheckedChange={(checked) => onChange(index, { ...shift, crosses_midnight: checked })}
              />
            </AdminSettingsToggleRow>
          </div>
        </div>
        {canRemove ? (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => onRemove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Working days</Label>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => (
            <label
              key={day.value}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
                shift.days_of_week?.includes(day.value) && 'border-primary/40 bg-primary/5',
              )}
            >
              <Checkbox
                className="h-3.5 w-3.5"
                checked={shift.days_of_week?.includes(day.value)}
                onCheckedChange={() => toggleDay(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
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

  const { data: locationsData } = useQuery({
    queryKey: ['attendance-locations'],
    queryFn: () => db.attendanceLocations.list(),
  });

  const departments = data?.departments || [];
  const locations = locationsData?.locations || [];

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

  const selectedLocation = useMemo(
    () => locations.find((item) => String(item.id) === String(form.attendance_location_id)),
    [locations, form.attendance_location_id],
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminSettingsToolbar
        label={<Label>Department</Label>}
        control={(
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-full">
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
        )}
        actions={(
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!departmentId || saveMutation.isPending}
            className={adminSettingsToolbarButtonClassName('gap-2')}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save department policy
          </Button>
        )}
        description={selectedDepartment
          ? `Rules apply to users assigned to ${selectedDepartment.name}.`
          : null}
      />

      <AdminSettingsToggleRow
        className="p-3"
        label={<Label>Enable rules for this department</Label>}
        description="When disabled, users in this department are not restricted."
      >
        <Switch
          checked={form.enabled}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
        />
      </AdminSettingsToggleRow>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2 px-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Location radius
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Assign a shared location. Multiple departments can use the same geofence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="space-y-2">
              <Label>Assigned location</Label>
              <Select
                value={form.attendance_location_id ? String(form.attendance_location_id) : 'none'}
                onValueChange={(value) => setForm((current) => ({
                  ...current,
                  attendance_location_id: value === 'none' ? null : Number(value),
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No location assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No location assigned</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={String(location.id)}>
                      {location.name}
                      {location.geofence_enabled ? ` · ${location.radius_meters}m` : ' · geofence off'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Manage locations in the Location radius section above. Changes apply to all assigned departments.
              </p>
            </div>

            {selectedLocation ? (
              <div className="rounded-xl border bg-muted/10 p-3 space-y-2 text-sm">
                <div className="font-medium">{selectedLocation.name}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    Geofence: {selectedLocation.geofence_enabled ? `enabled · ${selectedLocation.radius_meters}m radius` : 'disabled'}
                  </p>
                  {selectedLocation.sites?.length ? (
                    <p>
                      Sites: {selectedLocation.sites.map((site) => site.name).join(', ')}
                    </p>
                  ) : null}
                  {selectedLocation.allow_outside_radius ? (
                    <p>Outstation clock-in allowed with warning</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No location assigned. Users in this department will not be geofence-restricted.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2 px-4 sm:px-5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4 text-primary" />
                Working hours & shifts
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Define shifts per department, including night shifts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <TimezoneSelect
                    value={form.timezone}
                    onChange={(timezone) => setForm((current) => ({ ...current, timezone }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used to evaluate shift hours, grace period, and overtime for this department.
                  </p>
                </div>
                <div className="space-y-1.5">
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

              <AdminSettingsToggleRow
                className="p-3"
                label={<Label>Allow outside shift hours</Label>}
                description="Flag attendance recorded outside scheduled shifts."
              >
                <Switch
                  checked={form.allow_outside_shift_hours}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_outside_shift_hours: checked }))}
                />
              </AdminSettingsToggleRow>

              <div className="space-y-2">
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

              <Button type="button" variant="outline" size="sm" onClick={addShift} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Add shift
              </Button>

              <div className="space-y-3 rounded-xl border bg-muted/10 p-3">
                <div>
                  <h4 className="text-sm font-medium">Overtime</h4>
                  <p className="text-xs text-muted-foreground">
                    Calculate overtime when users clock out after their standard day.
                  </p>
                </div>

                <AdminSettingsToggleRow className="border-0 bg-transparent p-0" label={<Label>Track overtime</Label>}>
                  <Switch
                    checked={form.overtime_enabled}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, overtime_enabled: checked }))}
                  />
                </AdminSettingsToggleRow>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
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
                  <div className="space-y-1.5">
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
