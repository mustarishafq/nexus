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
import GeofenceMapPicker from '@/components/maps/GeofenceMapPicker';
import {
  attendanceLocationToPayload,
  DEFAULT_ATTENDANCE_LOCATION,
  normalizeAttendanceLocation,
  sharedAttendanceLocations,
} from '@/lib/attendanceLocation';
import { toast } from 'sonner';

const RADIUS_SLIDER_MIN = 10;
const RADIUS_SLIDER_MAX = 5000;
const RADIUS_SLIDER_STEP = 10;

function clampRadiusMeters(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 200;
  return Math.min(RADIUS_SLIDER_MAX, Math.max(RADIUS_SLIDER_MIN, n));
}

function SiteEditor({ site, index, onChange, onRemove, canRemove, onUseCurrentLocation, radiusMeters }) {
  return (
    <div className="rounded-xl border bg-muted/10 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Label</Label>
                <Input
                  value={site.name}
                  onChange={(event) => onChange(index, { ...site, name: event.target.value })}
                  placeholder="Main entrance"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Latitude</Label>
                  <Input
                    value={site.latitude}
                    className="tabular-nums"
                    onChange={(event) => onChange(index, { ...site, latitude: event.target.value })}
                    placeholder="3.1390"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Longitude</Label>
                  <Input
                    value={site.longitude}
                    className="tabular-nums"
                    onChange={(event) => onChange(index, { ...site, longitude: event.target.value })}
                    placeholder="101.6869"
                  />
                </div>
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
            className="w-full gap-2"
          >
            <MapPin className="h-3.5 w-3.5" />
            Use my location
          </Button>
        </div>

        <GeofenceMapPicker
          latitude={site.latitude}
          longitude={site.longitude}
          radiusMeters={radiusMeters}
          onChange={({ latitude, longitude }) => {
            onChange(index, { ...site, latitude, longitude });
          }}
        />
      </div>
    </div>
  );
}

export default function AttendanceLocationPanel({ peerHint = 'Insan' }) {
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState('');
  const [form, setForm] = useState(normalizeAttendanceLocation());

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-locations'],
    queryFn: () => db.attendanceLocations.list(),
  });

  const locations = useMemo(
    () => sharedAttendanceLocations(data?.locations),
    [data?.locations],
  );

  useEffect(() => {
    if (locationId === 'new') return;
    if (locationId && locations.some((item) => String(item.id) === locationId)) return;
    setLocationId(locations[0] ? String(locations[0].id) : '');
  }, [locationId, locations]);

  useEffect(() => {
    if (locationId === 'new') {
      setForm(normalizeAttendanceLocation({
        ...DEFAULT_ATTENDANCE_LOCATION,
        name: `Location ${locations.length + 1}`,
      }));
      return;
    }
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
      toast.success(
        locationId === 'new'
          ? `Location created — syncing to ${peerHint}`
          : `Location saved — syncing to ${peerHint}`,
      );
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
      toast.success(`Location deleted — syncing to ${peerHint}`);
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to delete location');
    },
  });

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

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!locationId && locations.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">No locations yet. Create a shared geofence to assign to departments.</p>
          <Button
            type="button"
            className="min-h-[40px] gap-2"
            onClick={() => setLocationId('new')}
          >
            <Plus className="h-4 w-4" />
            Create location
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">Location</CardTitle>
            <CardDescription>Pick a shared geofence to edit, or create a new one.</CardDescription>
          </div>
          <div className="flex gap-2">
            {locationId && locationId !== 'new' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="min-h-[40px] gap-2"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={!locationId || saveMutation.isPending}
              className="min-h-[40px] gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </CardHeader>
        {locationId ? (
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Select</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((entry) => (
                      <SelectItem key={entry.id} value={String(entry.id)}>
                        {entry.name}
                        {entry.department_count > 0 ? ` (${entry.department_count})` : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">+ New location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="EMZI HQ campus"
                />
              </div>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-full sm:max-w-md">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">+ New location</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        )}
      </Card>

      {locationId ? (
        <>
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Geofence</CardTitle>
              <CardDescription>
                Radius and whether clock in/out is allowed outside the fence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-stretch">
                <AdminSettingsToggleRow className="h-full p-3" label={<Label>Geofence</Label>}>
                  <Switch
                    checked={form.geofence_enabled}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, geofence_enabled: checked }))}
                  />
                </AdminSettingsToggleRow>

                <div className="relative z-10 space-y-2 rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Radius</Label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {clampRadiusMeters(form.radius_meters)} m
                    </span>
                  </div>
                  <Slider
                    min={RADIUS_SLIDER_MIN}
                    max={RADIUS_SLIDER_MAX}
                    step={RADIUS_SLIDER_STEP}
                    value={[clampRadiusMeters(form.radius_meters)]}
                    onValueChange={(values) => {
                      const next = Number(values?.[0]);
                      if (!Number.isFinite(next)) return;
                      setForm((current) => ({ ...current, radius_meters: next }));
                    }}
                    className="cursor-pointer py-2"
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminSettingsToggleRow className="h-full p-3" label={<Label>Allow clock in outside radius</Label>}>
                  <Switch
                    checked={form.allow_outside_radius}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_outside_radius: checked }))}
                  />
                </AdminSettingsToggleRow>

                <AdminSettingsToggleRow className="h-full p-3" label={<Label>Allow clock out outside radius</Label>}>
                  <Switch
                    checked={form.allow_clock_out_outside_radius}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_clock_out_outside_radius: checked }))}
                  />
                </AdminSettingsToggleRow>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-col gap-2 space-y-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Clock-in points</CardTitle>
                <CardDescription>
                  One or more pins that share this location’s radius.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSite} className="gap-2 self-start">
                <Plus className="h-4 w-4" />
                Add point
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.sites.map((site, index) => (
                <SiteEditor
                  key={index}
                  site={site}
                  index={index}
                  onChange={updateSite}
                  onRemove={removeSite}
                  canRemove={form.sites.length > 1}
                  onUseCurrentLocation={useCurrentLocation}
                  radiusMeters={form.radius_meters}
                />
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Select a location or create a new one.
        </p>
      )}
    </div>
  );
}
