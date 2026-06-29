import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';

import SplashAnimationPicker from '@/components/admin/SplashAnimationPicker';
import SplashMediaUploader from '@/components/admin/SplashMediaUploader';
import AdminSettingsToggleRow from '@/components/admin/AdminSettingsToggleRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import SplashLivePreview from '@/components/admin/SplashLivePreview';
import {
  buildSplashRuntime,
  detectSplashMediaType,
  mergeSystemNameAnimationCatalog,
  normalizeSplashConfig,
  resetSplashFormState,
  SPLASH_BACKGROUND_STYLES,
} from '@/lib/splashConfig';

function ColorField({ id, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border p-1"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="min-w-0 font-mono uppercase"
          placeholder="#022E96"
        />
      </div>
    </div>
  );
}

function SliderField({ id, label, hint, value, min, max, step = 1, formatValue, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Label htmlFor={id}>{label}</Label>
          {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums">{formatValue(value)}</span>
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

export default function SplashSettingsPanel({ settings, onChange }) {
  const splashConfig = useMemo(
    () => normalizeSplashConfig(settings),
    [settings],
  );
  const runtime = useMemo(
    () => buildSplashRuntime(splashConfig, splashConfig.animation_style, settings.system_name),
    [splashConfig, settings.system_name],
  );
  const titleAnimations = mergeSystemNameAnimationCatalog(settings.splash_system_name_animations);
  const backgroundStyles = settings.splash_background_styles?.length
    ? settings.splash_background_styles
    : SPLASH_BACKGROUND_STYLES;
  const mediaType = splashConfig.logo_url ? detectSplashMediaType(splashConfig.logo_url) : 'default';

  const patch = (updates) => onChange((current) => ({ ...current, ...updates }));

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-6 md:flex-row md:items-stretch">
      <div className="min-w-0 flex-1 space-y-6">
      <AdminSettingsToggleRow
        label={<p className="text-sm font-medium">Enable splash screen</p>}
        description="Show the splash when Nexus opens as a PWA or on the first visit in a browser session."
      >
        <Switch
          checked={settings.splash_enabled}
          onCheckedChange={(splash_enabled) => patch({ splash_enabled })}
        />
      </AdminSettingsToggleRow>

      <div className="md:hidden">
        <SplashLivePreview settings={settings} splashConfig={splashConfig} runtime={runtime} />
      </div>

      <div className="grid gap-4 rounded-2xl border p-3 sm:p-4">
        <div>
          <p className="text-sm font-medium">Custom logo / video</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload a file or paste a URL. Supports JPG, PNG, SVG, WebP, MP4, WebM, and MOV.
          </p>
        </div>

        <SplashMediaUploader
          value={settings.splash_logo_url || ''}
          splashConfig={splashConfig}
          onChange={(splash_logo_url) => patch({ splash_logo_url })}
          onClear={() => patch({ splash_logo_url: '' })}
        />

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or use a URL</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="splash_logo_url">Media URL</Label>
          <Input
            id="splash_logo_url"
            value={settings.splash_logo_url || ''}
            onChange={(event) => patch({ splash_logo_url: event.target.value })}
            placeholder="/storage/splash-media/logo.png or https://cdn.example.com/intro.mp4"
            className="min-w-0"
          />
          {settings.splash_logo_url ? (
            <p className="text-xs text-muted-foreground">
              Detected type: <span className="font-medium capitalize">{mediaType}</span>
            </p>
          ) : null}
        </div>

        <AdminSettingsToggleRow
          label={<p className="text-sm font-medium">Show logo / media</p>}
          description="Hide the center media while keeping motion effects."
        >
          <Switch
            checked={settings.splash_show_logo}
            onCheckedChange={(splash_show_logo) => patch({ splash_show_logo })}
          />
        </AdminSettingsToggleRow>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="splash_media_fit">Media fit</Label>
            <Select value={settings.splash_media_fit} onValueChange={(splash_media_fit) => patch({ splash_media_fit })}>
              <SelectTrigger id="splash_media_fit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">Contain</SelectItem>
                <SelectItem value="cover">Cover</SelectItem>
                <SelectItem value="fill">Fill</SelectItem>
              </SelectContent>
            </Select>
            {mediaType === 'video' ? (
              <p className="text-xs text-muted-foreground">
                Videos play full screen. The backdrop color is sampled from the clip so it matches before the first frame appears.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="splash_video_loop">Loop video</Label>
              <Switch
                id="splash_video_loop"
                checked={settings.splash_video_loop}
                onCheckedChange={(splash_video_loop) => patch({ splash_video_loop })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="splash_video_muted">Mute video</Label>
              <Switch
                id="splash_video_muted"
                checked={settings.splash_video_muted}
                onCheckedChange={(splash_video_muted) => patch({ splash_video_muted })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border p-3 sm:p-4">
        <AdminSettingsToggleRow
          label={<p className="text-sm font-medium">Show system name</p>}
          description="Displays the system name from branding settings on the splash screen."
        >
          <Switch
            checked={settings.splash_show_system_name}
            onCheckedChange={(splash_show_system_name) => patch({ splash_show_system_name })}
          />
        </AdminSettingsToggleRow>

        {settings.splash_show_system_name ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="splash_system_name_animation">Title animation</Label>
              <Select
                value={settings.splash_system_name_animation}
                onValueChange={(splash_system_name_animation) => patch({ splash_system_name_animation })}
              >
                <SelectTrigger id="splash_system_name_animation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {titleAnimations.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="splash_system_name_position">Title position</Label>
              <Select
                value={settings.splash_system_name_position}
                onValueChange={(splash_system_name_position) => patch({ splash_system_name_position })}
              >
                <SelectTrigger id="splash_system_name_position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="below">Below logo</SelectItem>
                  <SelectItem value="above">Above logo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ColorField
              id="splash_system_name_color"
              label="Title color"
              value={settings.splash_system_name_color}
              onChange={(splash_system_name_color) => patch({ splash_system_name_color })}
            />

            <SliderField
              id="splash_system_name_size_percent"
              label="Title size"
              value={settings.splash_system_name_size_percent}
              min={70}
              max={150}
              step={5}
              formatValue={(value) => `${value}%`}
              onChange={(splash_system_name_size_percent) => patch({ splash_system_name_size_percent })}
            />
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-3">
          <p className="text-sm font-medium">Animation style</p>
          <p className="text-xs text-muted-foreground">Pick the motion profile for the splash.</p>
        </div>
        <SplashAnimationPicker
          value={settings.splash_animation_style}
          catalog={settings.splash_animations}
          config={splashConfig}
          systemName={settings.system_name}
          onChange={(splash_animation_style) => patch({ splash_animation_style })}
        />
      </div>

      <div className="grid gap-4 rounded-2xl border p-3 sm:p-4 sm:grid-cols-2 lg:grid-cols-3">
        <ColorField
          id="splash_background_color"
          label="Background"
          value={settings.splash_background_color}
          onChange={(splash_background_color) => patch({ splash_background_color })}
        />
        <ColorField
          id="splash_accent_color"
          label="Accent"
          value={settings.splash_accent_color}
          onChange={(splash_accent_color) => patch({ splash_accent_color })}
        />
        <ColorField
          id="splash_secondary_color"
          label="Secondary"
          value={settings.splash_secondary_color}
          onChange={(splash_secondary_color) => patch({ splash_secondary_color })}
        />
      </div>

      <div className="grid gap-4 rounded-2xl border p-3 sm:p-4">
        <div>
          <p className="text-sm font-medium">Background style</p>
          <p className="text-xs text-muted-foreground mt-1">
            Gradients and mesh effects use your background, accent, and secondary colors.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="splash_background_style">Style</Label>
            <Select
              value={settings.splash_background_style || 'solid'}
              onValueChange={(splash_background_style) => patch({ splash_background_style })}
            >
              <SelectTrigger id="splash_background_style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {backgroundStyles.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {backgroundStyles.find((item) => item.id === (settings.splash_background_style || 'solid'))?.description ? (
              <p className="text-xs text-muted-foreground">
                {backgroundStyles.find((item) => item.id === (settings.splash_background_style || 'solid'))?.description}
              </p>
            ) : null}
          </div>

          {settings.splash_background_style === 'linear' ? (
            <SliderField
              id="splash_background_gradient_angle"
              label="Gradient angle"
              hint="Direction of the linear gradient."
              value={settings.splash_background_gradient_angle ?? 135}
              min={0}
              max={360}
              step={5}
              formatValue={(value) => `${value}°`}
              onChange={(splash_background_gradient_angle) => patch({ splash_background_gradient_angle })}
            />
          ) : null}

          {['mesh', 'aurora'].includes(settings.splash_background_style) ? (
            <SliderField
              id="splash_background_blur"
              label="Color blob blur"
              hint="How soft the gradient blobs appear."
              value={settings.splash_background_blur ?? 0}
              min={0}
              max={60}
              step={2}
              formatValue={(value) => `${value}px`}
              onChange={(splash_background_blur) => patch({ splash_background_blur })}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 rounded-2xl border p-3 sm:p-4 sm:grid-cols-2">
        <SliderField
          id="splash_min_duration_ms"
          label="Minimum display time"
          hint="Splash stays visible at least this long."
          value={settings.splash_min_duration_ms}
          min={400}
          max={5000}
          step={100}
          formatValue={(value) => `${(value / 1000).toFixed(1)}s`}
          onChange={(splash_min_duration_ms) => patch({ splash_min_duration_ms })}
        />
        <SliderField
          id="splash_max_duration_ms"
          label="Maximum display time"
          hint="Splash dismisses automatically after this limit."
          value={settings.splash_max_duration_ms}
          min={2000}
          max={12000}
          step={250}
          formatValue={(value) => `${(value / 1000).toFixed(1)}s`}
          onChange={(splash_max_duration_ms) => patch({ splash_max_duration_ms })}
        />
        <SliderField
          id="splash_speed_percent"
          label="Animation speed"
          hint="Higher values finish the motion faster."
          value={settings.splash_speed_percent}
          min={50}
          max={200}
          step={5}
          formatValue={(value) => `${value}%`}
          onChange={(splash_speed_percent) => patch({ splash_speed_percent })}
        />
        <SliderField
          id="splash_exit_fade_ms"
          label="Exit fade"
          hint="How long the splash fades out when closing."
          value={settings.splash_exit_fade_ms}
          min={150}
          max={1200}
          step={50}
          formatValue={(value) => `${value}ms`}
          onChange={(splash_exit_fade_ms) => patch({ splash_exit_fade_ms })}
        />
        <SliderField
          id="splash_logo_scale_percent"
          label="Logo size"
          value={settings.splash_logo_scale_percent}
          min={70}
          max={150}
          step={5}
          formatValue={(value) => `${value}%`}
          onChange={(splash_logo_scale_percent) => patch({ splash_logo_scale_percent })}
        />
        <SliderField
          id="splash_backdrop_blur"
          label="Backdrop blur"
          hint="Frosted-glass blur over the entire splash layer."
          value={settings.splash_backdrop_blur}
          min={0}
          max={24}
          step={1}
          formatValue={(value) => `${value}px`}
          onChange={(splash_backdrop_blur) => patch({ splash_backdrop_blur })}
        />
        <SliderField
          id="splash_background_overlay_opacity"
          label="Dark overlay"
          hint="Adds a dark layer over the background color."
          value={settings.splash_background_overlay_opacity}
          min={0}
          max={80}
          step={5}
          formatValue={(value) => `${value}%`}
          onChange={(splash_background_overlay_opacity) => patch({ splash_background_overlay_opacity })}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="gap-2 w-full sm:w-auto"
        onClick={() => patch(resetSplashFormState())}
      >
        <RotateCcw className="h-4 w-4" /> Reset splash settings to defaults
      </Button>
      </div>

      <aside className="relative hidden w-full shrink-0 md:block md:w-[min(100%,320px)] lg:w-[min(100%,380px)] xl:w-[min(100%,440px)]">
        <div className="md:sticky md:top-24 md:z-10 md:w-full">
          <div className="md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto">
            <SplashLivePreview settings={settings} splashConfig={splashConfig} runtime={runtime} />
          </div>
        </div>
      </aside>
    </div>
  );
}
