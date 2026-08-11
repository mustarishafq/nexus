import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { sharedAttendanceLocations } from '@/lib/attendanceLocation';
import {
  DEFAULT_SHIFT,
  departmentAttendanceSettingsToPayload,
  normalizeDepartmentAttendanceSettings,
  WEEKDAYS,
} from '@/lib/attendancePolicy';
import AdminSettingsToggleRow from '@/components/admin/AdminSettingsToggleRow';
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

function DepartmentMultiSelect({ departments, selectedIds, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const normalizedSearch = search.trim().toLowerCase();

  const filteredDepartments = useMemo(() => {
    if (!normalizedSearch) return departments;
    return departments.filter((entry) =>
      entry.department.name.toLowerCase().includes(normalizedSearch),
    );
  }, [departments, normalizedSearch]);

  const selectedDepartments = useMemo(
    () => departments.filter((entry) => selectedIds.includes(String(entry.department.id))),
    [departments, selectedIds],
  );

  const allSelected = departments.length > 0 && selectedIds.length === departments.length;

  const displayLabel = (() => {
    if (!selectedDepartments.length) return 'Select departments...';
    if (selectedDepartments.length === 1) return selectedDepartments[0].department.name;
    if (selectedDepartments.length <= 3) {
      return selectedDepartments.map((entry) => entry.department.name).join(', ');
    }
    return `${selectedDepartments.length} departments selected`;
  })();

  const toggleDepartment = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  const selectAll = () => {
    onChange(departments.map((entry) => String(entry.department.id)));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate text-left', !selectedDepartments.length && 'text-muted-foreground')}>
            {displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search departments..."
              className="h-8 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {selectedIds.length} selected
          </p>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={selectAll}>
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={clearAll}
              disabled={!selectedIds.length}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-1">
          {filteredDepartments.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {departments.length === 0 ? 'No departments available.' : 'No departments match your search.'}
            </p>
          ) : (
            filteredDepartments.map((entry) => {
              const id = String(entry.department.id);
              const checked = selectedIds.includes(id);

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleDepartment(id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                    checked ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60 text-muted-foreground',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    className="pointer-events-none h-3.5 w-3.5"
                    tabIndex={-1}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{entry.department.name}</span>
                  {checked ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>
        {allSelected ? (
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">All departments selected.</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function formatDepartmentNames(names) {
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function departmentMatchesCompany(entry, companyId) {
  if (!companyId || companyId === 'all') return true;
  const companyIds = (entry.department.company_ids || []).map(Number);
  return companyIds.includes(Number(companyId));
}

export default function DepartmentAttendancePolicyPanel({ peerHint = 'Insan' }) {
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState('all');
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState([]);
  const [form, setForm] = useState(normalizeDepartmentAttendanceSettings());

  const { data, isLoading } = useQuery({
    queryKey: ['department-attendance-settings'],
    queryFn: () => db.departmentAttendance.list(),
  });

  const { data: locationsData } = useQuery({
    queryKey: ['attendance-locations'],
    queryFn: () => db.attendanceLocations.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => db.listCompanies(),
    staleTime: 60_000,
  });

  const departments = data?.departments || [];
  const locations = sharedAttendanceLocations(locationsData?.locations);

  const filteredDepartments = useMemo(
    () => departments.filter((entry) => departmentMatchesCompany(entry, companyId)),
    [departments, companyId],
  );

  const settingsSourceId = selectedDepartmentIds[0] || '';

  useEffect(() => {
    const visibleIds = new Set(filteredDepartments.map((entry) => String(entry.department.id)));
    setSelectedDepartmentIds((current) => {
      const kept = current.filter((id) => visibleIds.has(id));
      if (
        kept.length === current.length
        && kept.every((id, index) => id === current[index])
        && (kept.length > 0 || filteredDepartments.length === 0)
      ) {
        return current;
      }
      if (kept.length) return kept;
      if (filteredDepartments.length) return [String(filteredDepartments[0].department.id)];
      return [];
    });
  }, [filteredDepartments]);

  useEffect(() => {
    if (!settingsSourceId) return;
    const entry = departments.find((item) => String(item.department.id) === settingsSourceId);
    if (entry) {
      setForm(normalizeDepartmentAttendanceSettings(entry.settings));
    }
  }, [settingsSourceId, departments]);

  const saveMutation = useMutation({
    mutationFn: () => db.departmentAttendance.bulkUpdate({
      department_ids: selectedDepartmentIds.map(Number),
      ...departmentAttendanceSettingsToPayload(form),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-attendance-settings'] });
      const count = selectedDepartmentIds.length;
      toast.success(
        count === 1
          ? `Department attendance policy saved — syncing to ${peerHint}`
          : `Attendance policy saved to ${count} departments — syncing to ${peerHint}`,
      );
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to save attendance policy');
    },
  });

  const selectedDepartments = useMemo(
    () => departments
      .filter((item) => selectedDepartmentIds.includes(String(item.department.id)))
      .map((item) => item.department),
    [departments, selectedDepartmentIds],
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

  const selectedNames = selectedDepartments.map((department) => department.name);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Company</Label>
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={String(company.id)}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label>Departments</Label>
          <DepartmentMultiSelect
            departments={filteredDepartments}
            selectedIds={selectedDepartmentIds}
            onChange={setSelectedDepartmentIds}
          />
          {selectedDepartments.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              Saving applies to {formatDepartmentNames(selectedNames)}.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!selectedDepartmentIds.length || saveMutation.isPending}
          className="min-h-[40px] gap-2"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {selectedDepartmentIds.length > 1 ? `Save (${selectedDepartmentIds.length})` : 'Save'}
        </Button>
      </div>

      <AdminSettingsToggleRow
        className="border-0 bg-transparent p-0"
        label={<Label>Enable rules</Label>}
      >
        <Switch
          checked={form.enabled}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
        />
      </AdminSettingsToggleRow>

      <div className="space-y-1.5">
        <Label>Location</Label>
        <Select
          value={form.attendance_location_id ? String(form.attendance_location_id) : 'none'}
          onValueChange={(value) => setForm((current) => ({
            ...current,
            attendance_location_id: value === 'none' ? null : Number(value),
          }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="No location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No location</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={String(location.id)}>
                {location.name}
                {location.geofence_enabled ? ` · ${location.radius_meters}m` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <TimezoneSelect
            value={form.timezone}
            onChange={(timezone) => setForm((current) => ({ ...current, timezone }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Grace period (min)</Label>
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
        className="border-0 bg-transparent p-0"
        label={<Label>Allow outside shift hours</Label>}
      >
        <Switch
          checked={form.allow_outside_shift_hours}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_outside_shift_hours: checked }))}
        />
      </AdminSettingsToggleRow>

      <AdminSettingsToggleRow
        className="border-0 bg-transparent p-0"
        label={<Label>Require early clock-out reason</Label>}
      >
        <Switch
          checked={form.require_early_clock_out_reason}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, require_early_clock_out_reason: checked }))}
        />
      </AdminSettingsToggleRow>

      <AdminSettingsToggleRow
        className="border-0 bg-transparent p-0"
        label={<Label>Require late clock-in reason</Label>}
      >
        <Switch
          checked={form.require_late_clock_in_reason}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, require_late_clock_in_reason: checked }))}
        />
      </AdminSettingsToggleRow>

      <div className="space-y-2">
        <Label>Shifts</Label>
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
        <Button type="button" variant="outline" size="sm" onClick={addShift} className="gap-2">
          <Plus className="h-4 w-4" />
          Add shift
        </Button>
      </div>

      <div className="space-y-3 border-t pt-4">
        <AdminSettingsToggleRow className="border-0 bg-transparent p-0" label={<Label>Track overtime</Label>}>
          <Switch
            checked={form.overtime_enabled}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, overtime_enabled: checked }))}
          />
        </AdminSettingsToggleRow>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Standard hours / day</Label>
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
            <Label>OT threshold (min)</Label>
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
    </div>
  );
}
