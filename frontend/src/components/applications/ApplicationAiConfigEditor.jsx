import React from 'react';
import { Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ApplicationAiConfigEditor({
  enabled,
  onEnabledChange,
}) {
  return (
    <div className="rounded-2xl border border-sky-500/20 bg-card/50 overflow-hidden shadow-sm">
      <div className="relative flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-sky-500/8 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">AI provider</p>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] h-5',
                  enabled
                    ? 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                    : 'text-muted-foreground'
                )}
              >
                {enabled ? 'Enabled' : 'Off'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Let this app send chat requests through Brain.
            </p>
          </div>
        </div>
        <div className="relative shrink-0">
          <Label htmlFor="application-ai-enabled" className="sr-only">Enable AI provider</Label>
          <Switch
            id="application-ai-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>
      </div>
    </div>
  );
}
