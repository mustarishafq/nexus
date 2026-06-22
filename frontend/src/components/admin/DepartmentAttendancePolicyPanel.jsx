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
  DEFAULT_SITE,
  departmentAttendanceSettingsToPayload,
  normalizeDepartmentAttendanceSettings,
  WEEKDAYS,
} from '@/lib/attendancePolicy';
import AdminSettingsToggleRow from '@/components/admin/AdminSettingsToggleRow';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function SiteEditor({ site, index, onChange, onRemove, canRemove, onUseCurrentLocation }) {
  return (
    <div className="rounded-xl border bg-muted/10 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label className="text-xs">Site name</Label>
            <Input
              value={site.name}
              onChange={(event) => onChange(index, { ...site, name: event.target.value })}
              placeholder="EMZI HQ"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Latitude</Label>
            <Input
              value={site.latitude}
              onChange={(event) => onChange(index, { ...site, latitude: event.target.value })}
              placeholder="3.1390"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Longitude</Label>
            <Input
              value={site.longitude}
              onChange={(event) => onChange(index, { ...site, longitude: event.target.value })}
              placeholder="101.6869"
            />
          </div>
        </div>
        {canRemove ? (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => onRemove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onUseCurrentLocation(index)}
        className="gap-2 w-full sm:w-auto"
      >
        <MapPin className="h-3.5 w-3.5" />
        Use my location
      </Button>
    </div>
  );
}

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
          <div className="flex items-end">
            <label className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm">
              <span className="text-xs text-muted-foreground">Crosses midnight</span>
              <Switch
                checked={Boolean(shift.crosses_midnight)}
                onCheckedChange={(checked) => onChange(index, { ...shift, crosses_midnight: checked })}
              />
            </label>
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

  const updateSite = (index, nextSite) => {
    setForm((current) => ({
      ...current,
      sites: current.sites.map((site, siteIndex) => (siteIndex === index ? nextSite : site)),
      center_latitude: index === 0 ? nextSite.latitude : current.center_latitude,
      center_longitude: index === 0 ? nextSite.longitude : current.center_longitude,
    }));
  };

  const addSite = () => {
    setForm((current) => ({
      ...current,
      sites: [...current.sites, { ...DEFAULT_SITE, name: `Site ${current.sites.length + 1}` }],
    }));
  };

  const removeSite = (index) => {
    setForm((current) => {
      const sites = current.sites.filter((_, siteIndex) => siteIndex !== index);
      const primarySite = sites[0];

      return {
        ...current,
        sites,
        center_latitude: primarySite?.latitude ?? '',
        center_longitude: primarySite?.longitude ?? '',
      };
    });
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

  const useCurrentLocation = (siteIndex = 0) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not available in this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);

        setForm((current) => ({
          ...current,
          geofence_enabled: true,
          sites: current.sites.map((site, index) => (
            index === siteIndex
              ? { ...site, latitude, longitude }
              : site
          )),
          center_latitude: siteIndex === 0 ? latitude : current.center_latitude,
          center_longitude: siteIndex === 0 ? longitude : current.center_longitude,
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-muted/10 p-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-2">
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
          className="gap-2 w-full lg:w-auto min-h-[40px] shrink-0"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save department policy
        </Button>
      </div>

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
              Register clock-in sites. Users within the radius see the site name on their photo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminSettingsToggleRow className="p-3 sm:col-span-2" label={<Label>Enable geofence</Label>}>
                <Switch
                  checked={form.geofence_enabled}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, geofence_enabled: checked }))}
                />
              </AdminSettingsToggleRow>

              <div className="space-y-2 sm:col-span-2">
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

              <AdminSettingsToggleRow
                className="p-3 sm:col-span-2"
                label={<Label>Allow outside radius</Label>}
                description="Allow outstation clock-in/out with a warning when outside all sites."
              >
                <Switch
                  checked={form.allow_outside_radius}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_outside_radius: checked }))}
                />
              </AdminSettingsToggleRow>
            </div>

            <div className="space-y-2">
              {form.sites.map((site, index) => (
                <SiteEditor
                  key={`${site.name}-${index}`}
                  site={site}
                  index={index}
                  onChange={updateSite}
                  onRemove={removeSite}
                  canRemove={form.sites.length > 1}
                  onUseCurrentLocation={useCurrentLocation}
                />
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addSite} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add site
            </Button>
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
                  <Input
                    value={form.timezone}
                    onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                    placeholder="Asia/Kuala_Lumpur"
                  />
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
