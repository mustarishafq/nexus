import React, { useMemo } from 'react';
import { Layout, Gauge, Sparkles, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import LaunchLivePreview from '@/components/admin/LaunchLivePreview';
import LaunchAnimationPicker from '@/components/admin/LaunchAnimationPicker';
import {
  launchConfigToFormState,
  getLaunchOverlayLayoutKind,
  mergeLaunchAnimationCatalog,
  mergeLaunchDurationCatalog,
  mergeLaunchOverlayModeCatalog,
  mergeLaunchProgressStyleCatalog,
  normalizeLaunchConfig,
} from '@/lib/launchConfig';

const LAYOUT_KIND_LABELS = {
  fullscreen: 'Full screen',
  panel: 'Floating panel',
  docked: 'Partial',
};

function OptionGrid({ options, value, onChange, columns = 'sm:grid-cols-2 xl:grid-cols-3', showLayoutKind = false }) {
  return (
    <div className={cn('grid grid-cols-1 gap-3', columns)}>
      {options.map((option) => {
        const selected = value === option.id;
        const layoutKind = showLayoutKind ? getLaunchOverlayLayoutKind(option.id) : null;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded-2xl border p-3 text-left transition-all',
              selected
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                : 'border-border bg-card hover:border-primary/35 hover:bg-muted/20',
            )}
          >
            {showLayoutKind ? (
              <div className="mb-2 overflow-hidden rounded-lg border border-border/80 bg-muted/30 p-2">
                <LayoutKindWireframe kind={layoutKind} />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{option.label}</p>
              {layoutKind ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {LAYOUT_KIND_LABELS[layoutKind]}
                </Badge>
              ) : null}
              {option.interactive ? (
                <Badge variant="outline" className="h-5 border-primary/30 px-1.5 text-[10px] text-primary">
                  Interactive
                </Badge>
              ) : null}
              {selected ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Selected</Badge> : null}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{option.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function LayoutKindWireframe({ kind }) {
  if (kind === 'fullscreen') {
    return (
      <div className="relative h-12 rounded-md border-2 border-dashed border-cyan-500/50 bg-cyan-500/10">
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
          Edge to edge
        </span>
      </div>
    );
  }

  if (kind === 'docked') {
    return (
      <div className="relative h-12 rounded-md border border-border bg-background">
        <div className="absolute inset-x-2 top-2 h-5 rounded-sm bg-muted/80" />
        <div className="absolute inset-x-0 bottom-0 h-3 rounded-b-md bg-primary/25" />
      </div>
    );
  }

  return (
    <div className="relative h-12 rounded-md border border-border bg-background">
      <div className="absolute inset-1 rounded-sm bg-muted/50" />
      <div className="absolute inset-x-3 top-2 bottom-2 rounded-md border border-violet-500/40 bg-violet-500/15" />
    </div>
  );
}

export default function LaunchSettingsPanel({ settings, onChange }) {
  const launchConfig = useMemo(() => normalizeLaunchConfig(settings), [settings]);
  const animations = mergeLaunchAnimationCatalog(settings.launch_animations);
  const overlayModes = mergeLaunchOverlayModeCatalog(settings.launch_overlay_modes);
  const progressStyles = mergeLaunchProgressStyleCatalog(settings.launch_progress_styles);
  const durations = mergeLaunchDurationCatalog(settings.launch_durations);

  const patch = (updates) => onChange((current) => ({
    ...current,
    ...launchConfigToFormState({ ...normalizeLaunchConfig(current), ...updates }),
    ...updates,
  }));

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="xl:hidden">
          <LaunchLivePreview settings={settings} launchConfig={launchConfig} />
        </div>

        <Tabs defaultValue="animation" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="animation" className="gap-1.5 text-xs sm:text-sm">
              <Sparkles className="h-3.5 w-3.5" /> Animation
            </TabsTrigger>
            <TabsTrigger value="layout" className="gap-1.5 text-xs sm:text-sm">
              <Layout className="h-3.5 w-3.5" /> Layout
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-1.5 text-xs sm:text-sm">
              <Gauge className="h-3.5 w-3.5" /> Progress
            </TabsTrigger>
            <TabsTrigger value="behavior" className="gap-1.5 text-xs sm:text-sm">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Behavior
            </TabsTrigger>
          </TabsList>

          <TabsContent value="animation" className="space-y-3">
            <LaunchAnimationPicker
              value={settings.launch_animation_style}
              onChange={(launch_animation_style) => patch({ animation_style: launch_animation_style, launch_animation_style })}
              catalog={animations}
            />
          </TabsContent>

          <TabsContent value="layout" className="space-y-3">
            <div>
              <Label>Overlay layout</Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                How the launch experience is framed on screen.
              </p>
            </div>
            <OptionGrid
              options={overlayModes}
              value={settings.launch_overlay_mode}
              onChange={(launch_overlay_mode) => patch({ overlay_mode: launch_overlay_mode, launch_overlay_mode })}
              showLayoutKind
            />
          </TabsContent>

          <TabsContent value="progress" className="space-y-3">
            <div>
              <Label>Progress indicator</Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Visual feedback while the application prepares to open.
              </p>
            </div>
            <OptionGrid
              options={progressStyles}
              value={settings.launch_progress_style}
              onChange={(launch_progress_style) => patch({ progress_style: launch_progress_style, launch_progress_style })}
            />
          </TabsContent>

          <TabsContent value="behavior" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="launch_duration">Launch duration</Label>
              <Select
                value={settings.launch_duration}
                onValueChange={(launch_duration) => patch({ duration: launch_duration, launch_duration })}
              >
                <SelectTrigger id="launch_duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durations.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {durations.find((item) => item.id === settings.launch_duration)?.description}
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="launch_interactive">Interactive boosts</Label>
                  <p className="text-xs text-muted-foreground">Let users tap to accelerate the launch sequence.</p>
                </div>
                <Switch
                  id="launch_interactive"
                  checked={settings.launch_interactive}
                  onCheckedChange={(launch_interactive) => patch({ interactive: launch_interactive, launch_interactive })}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="launch_show_hint">Show hint text</Label>
                  <p className="text-xs text-muted-foreground">Display guidance below the progress indicator.</p>
                </div>
                <Switch
                  id="launch_show_hint"
                  checked={settings.launch_show_hint}
                  onCheckedChange={(launch_show_hint) => patch({ show_hint: launch_show_hint, launch_show_hint })}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="launch_show_skip">Show skip button</Label>
                  <p className="text-xs text-muted-foreground">Allow users to skip or continue once ready.</p>
                </div>
                <Switch
                  id="launch_show_skip"
                  checked={settings.launch_show_skip}
                  onCheckedChange={(launch_show_skip) => patch({ show_skip: launch_show_skip, launch_show_skip })}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <aside className="relative hidden w-full shrink-0 xl:block xl:w-[min(100%,480px)]">
        <div className="xl:sticky xl:top-24 xl:z-10 xl:w-full">
          <LaunchLivePreview settings={settings} launchConfig={launchConfig} />
        </div>
      </aside>
    </div>
  );
}
