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
import LaunchOverlayModePicker from '@/components/admin/LaunchOverlayModePicker';
import {
  launchConfigToFormState,
  mergeLaunchAnimationCatalog,
  mergeLaunchDurationCatalog,
  mergeLaunchProgressStyleCatalog,
  normalizeLaunchConfig,
} from '@/lib/launchConfig';

function OptionGrid({ options, value, onChange, columns = 'sm:grid-cols-2 lg:grid-cols-3' }) {
  return (
    <div className={cn('grid grid-cols-1 gap-3', columns)}>
      {options.map((option) => {
        const selected = value === option.id;

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
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{option.label}</p>
              {selected ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Selected</Badge> : null}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{option.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export default function LaunchSettingsPanel({ settings, onChange }) {
  const launchConfig = useMemo(() => normalizeLaunchConfig(settings), [settings]);
  const animations = mergeLaunchAnimationCatalog(settings.launch_animations);
  const progressStyles = mergeLaunchProgressStyleCatalog(settings.launch_progress_styles);
  const durations = mergeLaunchDurationCatalog(settings.launch_durations);

  const patch = (updates) => onChange((current) => ({
    ...current,
    ...launchConfigToFormState({ ...normalizeLaunchConfig(current), ...updates }),
    ...updates,
  }));

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-6 md:flex-row md:items-stretch">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="md:hidden">
          <LaunchLivePreview settings={settings} launchConfig={launchConfig} />
        </div>

        <Tabs defaultValue="animation" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="animation" className="gap-1.5 min-h-[40px] px-2 text-xs sm:min-h-0 sm:px-3 sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 shrink-0" /> Animation
            </TabsTrigger>
            <TabsTrigger value="layout" className="gap-1.5 min-h-[40px] px-2 text-xs sm:min-h-0 sm:px-3 sm:text-sm">
              <Layout className="h-3.5 w-3.5 shrink-0" /> Layout
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-1.5 min-h-[40px] px-2 text-xs sm:min-h-0 sm:px-3 sm:text-sm">
              <Gauge className="h-3.5 w-3.5 shrink-0" /> Progress
            </TabsTrigger>
            <TabsTrigger value="behavior" className="gap-1.5 min-h-[40px] px-2 text-xs sm:min-h-0 sm:px-3 sm:text-sm">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" /> Behavior
            </TabsTrigger>
          </TabsList>

          <TabsContent value="animation" className="space-y-3">
            <LaunchAnimationPicker
              value={launchConfig.animation_style}
              onChange={(launch_animation_style) => patch({ animation_style: launch_animation_style, launch_animation_style })}
              catalog={animations}
            />
          </TabsContent>

          <TabsContent value="layout" className="space-y-3">
            <LaunchOverlayModePicker
              value={launchConfig.overlay_mode}
              onChange={(launch_overlay_mode) => patch({ overlay_mode: launch_overlay_mode, launch_overlay_mode })}
              catalog={settings.launch_overlay_modes}
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

            <div className="grid gap-3 rounded-2xl border p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="launch_interactive">Interactive boosts</Label>
                  <p className="text-xs text-muted-foreground">Let users tap to accelerate the launch sequence.</p>
                </div>
                <Switch
                  id="launch_interactive"
                  className="shrink-0 self-end sm:self-auto"
                  checked={settings.launch_interactive}
                  onCheckedChange={(launch_interactive) => patch({ interactive: launch_interactive, launch_interactive })}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="launch_show_hint">Show hint text</Label>
                  <p className="text-xs text-muted-foreground">Display guidance below the progress indicator.</p>
                </div>
                <Switch
                  id="launch_show_hint"
                  className="shrink-0 self-end sm:self-auto"
                  checked={settings.launch_show_hint}
                  onCheckedChange={(launch_show_hint) => patch({ show_hint: launch_show_hint, launch_show_hint })}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="launch_show_skip">Show skip button</Label>
                  <p className="text-xs text-muted-foreground">Allow users to skip or continue once ready.</p>
                </div>
                <Switch
                  id="launch_show_skip"
                  className="shrink-0 self-end sm:self-auto"
                  checked={settings.launch_show_skip}
                  onCheckedChange={(launch_show_skip) => patch({ show_skip: launch_show_skip, launch_show_skip })}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <aside className="relative hidden w-full shrink-0 md:block md:w-[min(100%,340px)] lg:w-[min(100%,400px)] xl:w-[min(100%,480px)]">
        <div className="md:sticky md:top-24 md:z-10 md:w-full">
          <div className="md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto">
            <LaunchLivePreview settings={settings} launchConfig={launchConfig} />
          </div>
        </div>
      </aside>
    </div>
  );
}
