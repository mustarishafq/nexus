import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import AdminSettingsToggleRow from '@/components/admin/AdminSettingsToggleRow';
import AdminSettingsToolbar, { adminSettingsToolbarButtonClassName } from '@/components/admin/AdminSettingsToolbar';
import {
  attendanceLocationToPayload,
  DEFAULT_ATTENDANCE_LOCATION,
  normalizeAttendanceLocation,
} from '@/lib/attendanceLocation';
import { toast } from 'sonner';

function SiteEditor({ site, index, onChange, onRemove, canRemove, onUseCurrentLocation }) {
  return (
    <div className="rounded-xl border bg-muted/10 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label className="text-xs">Clock-in label</Label>
            <Input
              value={site.name}
              onChange={(event) => onChange(index, { ...site, name: event.target.value })}
              placeholder="Main entrance"
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

export default function AttendanceLocationPanel() {
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState('');
  const [form, setForm] = useState(normalizeAttendanceLocation());

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-locations'],
    queryFn: () => db.attendanceLocations.list(),
  });

  const locations = data?.locations || [];

  useEffect(() => {
    if (!locationId && locations.length) {
      setLocationId(String(locations[0].id));
    }
  }, [locationId, locations]);

  useEffect(() => {
    const entry = locations.find((item) => String(item.id) === locationId);
    if (entry) {
      setForm(normalizeAttendanceLocation(entry));
    }
  }, [locationId, locations]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = attendanceLocationToPayload(form);
      if (locationId === 'new') {
        return db.attendanceLocations.create(payload);
      }
      return db.attendanceLocations.update(locationId, payload);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-locations'] });
      queryClient.invalidateQueries({ queryKey: ['department-attendance-settings'] });
      if (response?.location?.id) {
        setLocationId(String(response.location.id));
      }
      toast.success(locationId === 'new' ? 'Location created' : 'Location saved');
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to save location');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => db.attendanceLocations.delete(locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-locations'] });
      queryClient.invalidateQueries({ queryKey: ['department-attendance-settings'] });
      setLocationId('');
      toast.success('Location deleted');
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to delete location');
    },
  });

  const selectedLocation = useMemo(
    () => locations.find((item) => String(item.id) === locationId),
    [locations, locationId],
  );

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
      sites: [...current.sites, { name: `Site ${current.sites.length + 1}`, latitude: '', longitude: '' }],
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

  const startNewLocation = () => {
    setLocationId('new');
    setForm(normalizeAttendanceLocation({
      ...DEFAULT_ATTENDANCE_LOCATION,
      name: `Location ${locations.length + 1}`,
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
        label={<Label>Location</Label>}
        control={(
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((entry) => (
                <SelectItem key={entry.id} value={String(entry.id)}>
                  {entry.name}
                  {entry.department_count > 0 ? ` (${entry.department_count} dept${entry.department_count === 1 ? '' : 's'})` : ''}
                </SelectItem>
              ))}
              <SelectItem value="new">+ Create new location</SelectItem>
            </SelectContent>
          </Select>
        )}
        actions={(
          <>
            <Button
              type="button"
              variant="outline"
              onClick={startNewLocation}
              className={adminSettingsToolbarButtonClassName('gap-2')}
            >
              <Plus className="h-4 w-4" />
              New location
            </Button>
            {locationId && locationId !== 'new' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className={adminSettingsToolbarButtonClassName('gap-2')}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={!locationId || saveMutation.isPending}
              className={adminSettingsToolbarButtonClassName('gap-2 shrink-0')}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {locationId === 'new' ? 'Create location' : 'Save location'}
            </Button>
          </>
        )}
        description={selectedLocation
          ? `Shared by ${selectedLocation.department_count} department${selectedLocation.department_count === 1 ? '' : 's'}. Edit once to update all assigned departments.`
          : locationId === 'new'
            ? 'Create a reusable location radius that can be assigned to multiple departments.'
            : null}
      />

      {locationId ? (
        <>
          <div className="space-y-1.5">
            <Label>Location name</Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="EMZI HQ campus"
            />
            <p className="text-xs text-muted-foreground">
              Admin label for this shared geofence. Shown when assigning to departments.
            </p>
          </div>

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
            <div>
              <Label>Clock-in points</Label>
              <p className="text-xs text-muted-foreground mt-1">
                GPS coordinates with a radius. Each point has its own label shown on the attendance photo when a user clocks in nearby.
              </p>
            </div>
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
            Add clock-in point
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Select or create a location to configure geofence settings.</p>
      )}
    </div>
  );
}
