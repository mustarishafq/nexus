export const DEFAULT_ATTENDANCE_LOCATION = {
  name: 'New location',
  geofence_enabled: false,
  center_latitude: '',
  center_longitude: '',
  sites: [{ name: 'EMZI HQ', latitude: '', longitude: '' }],
  radius_meters: 200,
  allow_outside_radius: false,
};

export function normalizeAttendanceLocation(input = {}) {
  let sites = Array.isArray(input.sites) && input.sites.length
    ? input.sites.map((site) => ({
      name: site.name || 'Site',
      latitude: site.latitude ?? '',
      longitude: site.longitude ?? '',
    }))
    : [];

  if (!sites.length && input.center_latitude != null && input.center_latitude !== ''
    && input.center_longitude != null && input.center_longitude !== '') {
    sites = [{
      name: 'Primary location',
      latitude: input.center_latitude,
      longitude: input.center_longitude,
    }];
  }

  if (!sites.length) {
    sites = [{ ...DEFAULT_ATTENDANCE_LOCATION.sites[0] }];
  }

  const primarySite = sites[0];

  return {
    id: input.id ?? null,
    name: input.name || DEFAULT_ATTENDANCE_LOCATION.name,
    geofence_enabled: Boolean(input.geofence_enabled),
    center_latitude: input.center_latitude ?? primarySite.latitude ?? '',
    center_longitude: input.center_longitude ?? primarySite.longitude ?? '',
    sites,
    radius_meters: Number(input.radius_meters ?? 200),
    allow_outside_radius: Boolean(input.allow_outside_radius),
    department_count: Number(input.department_count ?? 0),
  };
}

export function attendanceLocationToPayload(form) {
  const normalized = normalizeAttendanceLocation(form);
  const sites = normalized.sites
    .map((site) => ({
      name: site.name,
      latitude: site.latitude === '' ? null : Number(site.latitude),
      longitude: site.longitude === '' ? null : Number(site.longitude),
    }))
    .filter((site) => site.name && site.latitude != null && site.longitude != null);

  const primarySite = sites[0] || null;

  return {
    name: normalized.name,
    geofence_enabled: normalized.geofence_enabled,
    sites,
    center_latitude: primarySite?.latitude ?? null,
    center_longitude: primarySite?.longitude ?? null,
    radius_meters: normalized.radius_meters,
    allow_outside_radius: normalized.allow_outside_radius,
  };
}
