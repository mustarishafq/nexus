import db from '@/api/apiClient';
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

function SiteEditor({ site, index, onChange, onRemove, canRemove, onUseCurrentLocation, radiusMeters }) {
  return (
    <div className="rounded-xl border bg-muted/10 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Geofence pin</p>
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

      <GeofenceMapPicker
        latitude={site.latitude}
        longitude={site.longitude}
        radiusMeters={radiusMeters}
        onChange={({ latitude, longitude }) => {
          onChange(index, { ...site, latitude, longitude });
        }}
      />
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

  const locations = sharedAttendanceLocations(data?.locations);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label>Location</Label>
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
      </div>

      {locationId ? (
        <>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="EMZI HQ campus"
            />
          </div>

          <div className="space-y-3">
            <AdminSettingsToggleRow className="border-0 bg-transparent p-0" label={<Label>Geofence</Label>}>
              <Switch
                checked={form.geofence_enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, geofence_enabled: checked }))}
              />
            </AdminSettingsToggleRow>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Radius</Label>
                <span className="text-sm tabular-nums text-muted-foreground">{form.radius_meters} m</span>
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
              className="border-0 bg-transparent p-0"
              label={<Label>Allow clock in outside radius</Label>}
            >
              <Switch
                checked={form.allow_outside_radius}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_outside_radius: checked }))}
              />
            </AdminSettingsToggleRow>

            <AdminSettingsToggleRow
              className="border-0 bg-transparent p-0"
              label={<Label>Allow clock out outside radius</Label>}
            >
              <Switch
                checked={form.allow_clock_out_outside_radius}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_clock_out_outside_radius: checked }))}
              />
            </AdminSettingsToggleRow>
          </div>

          <div className="space-y-2">
            <Label>Clock-in points</Label>
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
            <Button type="button" variant="outline" size="sm" onClick={addSite} className="gap-2">
              <Plus className="h-4 w-4" />
              Add point
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Select a location or create a new one.</p>
      )}
    </div>
  );
}
