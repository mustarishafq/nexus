import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import WatermarkLivePreview from '@/components/admin/WatermarkLivePreview';
import AttendanceWatermarkLogoUploader from '@/components/admin/AttendanceWatermarkLogoUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  ATTENDANCE_DATETIME_FORMATS,
  ATTENDANCE_LOGO_POSITIONS,
  ATTENDANCE_WATERMARK_POSITIONS,
  normalizeAttendanceWatermarkConfig,
  resetAttendanceWatermarkFormState,
} from '@/lib/watermarkConfig';

function ColorField({ id, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-14 cursor-pointer rounded-lg border p-1"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="font-mono uppercase"
        />
      </div>
    </div>
  );
}

function SliderField({ id, label, hint, value, min, max, step = 1, formatValue, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor={id}>{label}</Label>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="text-sm font-medium tabular-nums">{formatValue(value)}</span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
      />
    </div>
  );
}

export default function WatermarkSettingsPanel({ settings, onChange }) {
  const config = useMemo(() => normalizeAttendanceWatermarkConfig(settings), [settings]);

  const datetimeFormats = settings.attendance_datetime_formats?.length
    ? settings.attendance_datetime_formats
    : ATTENDANCE_DATETIME_FORMATS;

  const positions = settings.attendance_watermark_positions?.length
    ? settings.attendance_watermark_positions
    : ATTENDANCE_WATERMARK_POSITIONS;

  const updateField = (field, value) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
          <div>
            <Label htmlFor="attendance_enabled">Enable clock in/out</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Allow users to record attendance with watermarked photos.</p>
          </div>
          <Switch
            id="attendance_enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => updateField('attendance_enabled', checked)}
          />
        </div>

        {config.enabled ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <Label htmlFor="attendance_clock_in_redirect_enabled">Auto-redirect to attendance</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send users to the attendance page when they open the app and still need to clock in.
              </p>
            </div>
            <Switch
              id="attendance_clock_in_redirect_enabled"
              checked={config.clock_in_redirect_enabled}
              onCheckedChange={(checked) => updateField('attendance_clock_in_redirect_enabled', checked)}
            />
          </div>
        ) : null}

        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="attendance_watermark_show_logo">Show logo</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Place your company logo above the watermark text.</p>
            </div>
            <Switch
              id="attendance_watermark_show_logo"
              checked={config.show_logo}
              onCheckedChange={(checked) => updateField('attendance_watermark_show_logo', checked)}
            />
          </div>

          {config.show_logo ? (
            <>
              <AttendanceWatermarkLogoUploader
                value={config.logo_url}
                onChange={(url) => updateField('attendance_watermark_logo_url', url)}
                onClear={() => updateField('attendance_watermark_logo_url', '')}
              />
              <SliderField
                id="attendance_watermark_logo_size_percent"
                label="Logo size"
                hint="Relative to photo width"
                value={config.logo_size_percent}
                min={50}
                max={200}
                formatValue={(value) => `${value}%`}
                onChange={(value) => updateField('attendance_watermark_logo_size_percent', value)}
              />
              <SliderField
                id="attendance_watermark_logo_opacity"
                label="Logo opacity"
                value={config.logo_opacity}
                min={0}
                max={100}
                formatValue={(value) => `${value}%`}
                onChange={(value) => updateField('attendance_watermark_logo_opacity', value)}
              />
              <div className="space-y-2">
                <Label htmlFor="attendance_watermark_logo_position">Logo alignment</Label>
                <Select
                  value={config.logo_position}
                  onValueChange={(value) => updateField('attendance_watermark_logo_position', value)}
                >
                  <SelectTrigger id="attendance_watermark_logo_position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(settings.attendance_logo_positions?.length
                      ? settings.attendance_logo_positions
                      : ATTENDANCE_LOGO_POSITIONS
                    ).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <Label htmlFor="attendance_watermark_show_user_name">User name</Label>
            <Switch
              id="attendance_watermark_show_user_name"
              checked={config.show_user_name}
              onCheckedChange={(checked) => updateField('attendance_watermark_show_user_name', checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <Label htmlFor="attendance_watermark_show_datetime">Date & time</Label>
            <Switch
              id="attendance_watermark_show_datetime"
              checked={config.show_datetime}
              onCheckedChange={(checked) => updateField('attendance_watermark_show_datetime', checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <Label htmlFor="attendance_watermark_show_location">Street / address</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Road name and area from GPS reverse geocoding.</p>
            </div>
            <Switch
              id="attendance_watermark_show_location"
              checked={config.show_location}
              onCheckedChange={(checked) => updateField('attendance_watermark_show_location', checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <Label htmlFor="attendance_watermark_show_coordinates">GPS coordinates</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Latitude and longitude as a separate watermark line.</p>
            </div>
            <Switch
              id="attendance_watermark_show_coordinates"
              checked={config.show_coordinates}
              onCheckedChange={(checked) => updateField('attendance_watermark_show_coordinates', checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <Label htmlFor="attendance_watermark_show_device_info">Device info</Label>
            <Switch
              id="attendance_watermark_show_device_info"
              checked={config.show_device_info}
              onCheckedChange={(checked) => updateField('attendance_watermark_show_device_info', checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <Label htmlFor="attendance_watermark_show_custom_text">Custom text</Label>
            <Switch
              id="attendance_watermark_show_custom_text"
              checked={config.show_custom_text}
              onCheckedChange={(checked) => updateField('attendance_watermark_show_custom_text', checked)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="attendance_watermark_datetime_format">Date/time format</Label>
            <Select
              value={config.datetime_format}
              onValueChange={(value) => updateField('attendance_watermark_datetime_format', value)}
            >
              <SelectTrigger id="attendance_watermark_datetime_format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {datetimeFormats.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendance_watermark_position">Position</Label>
            <Select
              value={config.position}
              onValueChange={(value) => updateField('attendance_watermark_position', value)}
            >
              <SelectTrigger id="attendance_watermark_position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {positions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="attendance_watermark_custom_text">Custom watermark text</Label>
            <Input
              id="attendance_watermark_custom_text"
              value={config.custom_text}
              onChange={(event) => updateField('attendance_watermark_custom_text', event.target.value)}
              placeholder="e.g. EMZI Properties HQ"
              disabled={!config.show_custom_text}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ColorField
            id="attendance_watermark_text_color"
            label="Text color"
            value={config.text_color}
            onChange={(value) => updateField('attendance_watermark_text_color', value)}
          />
          <ColorField
            id="attendance_watermark_background_color"
            label="Background color"
            value={config.background_color}
            onChange={(value) => updateField('attendance_watermark_background_color', value)}
          />
        </div>

        <SliderField
          id="attendance_watermark_font_size_percent"
          label="Font size"
          hint="Relative to photo width"
          value={config.font_size_percent}
          min={50}
          max={200}
          formatValue={(value) => `${value}%`}
          onChange={(value) => updateField('attendance_watermark_font_size_percent', value)}
        />

        <SliderField
          id="attendance_watermark_background_opacity"
          label="Background opacity"
          value={config.background_opacity}
          min={0}
          max={100}
          formatValue={(value) => `${value}%`}
          onChange={(value) => updateField('attendance_watermark_background_opacity', value)}
        />

        <SliderField
          id="attendance_watermark_margin_percent"
          label="Edge margin"
          value={config.margin_percent}
          min={1}
          max={15}
          formatValue={(value) => `${value}%`}
          onChange={(value) => updateField('attendance_watermark_margin_percent', value)}
        />

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => onChange((current) => ({ ...current, ...resetAttendanceWatermarkFormState() }))}
        >
          <RotateCcw className="h-4 w-4" /> Reset watermark defaults
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Live preview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sample location data is shown here. On the attendance page, real GPS and street address are used.
          </p>
        </div>
        <WatermarkLivePreview settings={settings} />
      </div>
    </div>
  );
}
