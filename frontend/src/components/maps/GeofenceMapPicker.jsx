// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [3.139, 101.6869];
const DEFAULT_ZOOM = 15;

function parseCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function FlyToPin({ lat, lng, version }) {
  const map = useMap();

  useEffect(() => {
    if (lat == null || lng == null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), DEFAULT_ZOOM), { duration: 0.6 });
  }, [lat, lng, version, map]);

  return null;
}

function InvalidateSize() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

export default function GeofenceMapPicker({
  latitude,
  longitude,
  radiusMeters = 100,
  onChange,
  className = '',
}) {
  const lastMapPick = useRef(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [flyVersion, setFlyVersion] = useState(0);

  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);
  const hasPin = lat != null && lng != null;
  const center = useMemo(() => (hasPin ? [lat, lng] : DEFAULT_CENTER), [hasPin, lat, lng]);
  const radius = Math.max(10, Number(radiusMeters) || 100);

  useEffect(() => {
    if (!hasPin) return;
    const last = lastMapPick.current;
    if (last && Math.abs(last.lat - lat) < 1e-7 && Math.abs(last.lng - lng) < 1e-7) {
      return;
    }
    setFlyVersion((value) => value + 1);
  }, [hasPin, lat, lng]);

  const pick = (nextLat, nextLng) => {
    const roundedLat = Number(nextLat.toFixed(6));
    const roundedLng = Number(nextLng.toFixed(6));
    lastMapPick.current = { lat: roundedLat, lng: roundedLng };
    onChange?.({ latitude: String(roundedLat), longitude: String(roundedLng) });
  };

  const searchPlaces = async () => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('q', term);
      url.searchParams.set('limit', '5');
      url.searchParams.set('addressdetails', '0');

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (item) => {
    const nextLat = Number(item.lat);
    const nextLng = Number(item.lon);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
    pick(nextLat, nextLng);
    setQuery(item.display_name || '');
    setResults([]);
    setFlyVersion((value) => value + 1);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                searchPlaces();
              }
            }}
            placeholder="Search address or place"
            className="pl-8"
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={searching || query.trim().length < 2}
          onClick={() => searchPlaces()}
        >
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
        </Button>
        {results.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-[1000] mt-1 max-h-48 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
            {results.map((item) => (
              <li key={`${item.place_id}-${item.lat}-${item.lon}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                  onClick={() => selectResult(item)}
                >
                  {item.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <MapContainer
          center={center}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          className="h-56 w-full sm:h-64 z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <InvalidateSize />
          <MapClickHandler onPick={pick} />
          {hasPin ? <FlyToPin lat={lat} lng={lng} version={flyVersion} /> : null}
          {hasPin ? (
            <>
              <Marker
                position={[lat, lng]}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const position = event.target.getLatLng();
                    pick(position.lat, position.lng);
                  },
                }}
              />
              <Circle
                center={[lat, lng]}
                radius={radius}
                pathOptions={{
                  color: 'hsl(var(--primary))',
                  fillColor: 'hsl(var(--primary))',
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              />
            </>
          ) : null}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        {hasPin
          ? 'Drag the pin or tap the map to adjust. The circle shows your clock-in radius.'
          : 'Search for a place or tap the map to drop your geofence pin.'}
      </p>
    </div>
  );
}
