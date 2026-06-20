import React from 'react';
import { cn } from '@/lib/utils';
import { getLaunchOverlayLayoutKind } from '@/lib/launchConfig';

export default function LaunchPreviewLayoutGuide({ overlayMode, layoutLabel }) {
  const kind = getLaunchOverlayLayoutKind(overlayMode);

  if (kind === 'fullscreen') {
    return (
      <div className="pointer-events-none absolute inset-0 z-30">
        <div className="absolute inset-2 rounded-[1.25rem] border-2 border-dashed border-cyan-300/70" />
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-cyan-300/40 bg-cyan-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100 shadow-sm backdrop-blur-sm">
          Full screen
        </div>
        <span className="absolute left-3 top-3 text-[9px] font-medium text-cyan-200/80">Screen edge</span>
        <span className="absolute right-3 top-3 text-[9px] font-medium text-cyan-200/80">Screen edge</span>
        <span className="absolute bottom-3 left-3 text-[9px] font-medium text-cyan-200/80">Screen edge</span>
        <span className="absolute bottom-3 right-3 text-[9px] font-medium text-cyan-200/80">Screen edge</span>
      </div>
    );
  }

  if (kind === 'docked') {
    return (
      <div className="pointer-events-none absolute inset-0 z-30">
        <div className="absolute left-3 top-12 max-w-[120px] rounded-lg border border-amber-300/35 bg-amber-500/15 px-2 py-1.5 text-[10px] leading-snug text-amber-100 backdrop-blur-sm">
          <span className="font-semibold uppercase tracking-wide">Partial overlay</span>
          <span className="mt-0.5 block text-[9px] text-amber-100/80">App stays visible above</span>
        </div>
        <div className="absolute inset-x-8 top-16 bottom-24 rounded-xl border border-white/15 border-dashed" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="absolute left-3 top-12 max-w-[132px] rounded-lg border border-violet-300/35 bg-violet-500/15 px-2 py-1.5 text-[10px] leading-snug text-violet-100 backdrop-blur-sm">
        <span className="font-semibold uppercase tracking-wide">Floating panel</span>
        <span className="mt-0.5 block text-[9px] text-violet-100/80">App grid visible around edges</span>
      </div>
      <div
        className={cn(
          'absolute left-1/2 top-1/2 h-[58%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-2xl',
          'border-2 border-dashed border-violet-300/60',
        )}
      />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] text-white/55">
        {layoutLabel?.modeLabel || 'Panel'} area
      </div>
    </div>
  );
}
