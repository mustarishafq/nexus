import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getDisplayName } from '@/lib/profile';
import { TopStripBadge, TOP_STRIP_ROW_CLASS } from '@/components/layout/TopStripBadge';
import { cn } from '@/lib/utils';

export default function ImpersonationStrip({ embedded = false, onVisibilityChange }) {
  const { user, isImpersonating, stopImpersonation } = useAuth();
  const [exiting, setExiting] = useState(false);
  const visible = Boolean(isImpersonating);

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [onVisibilityChange, visible]);

  if (!visible) {
    return null;
  }

  const name = getDisplayName(user, 'user');

  const handleExit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await stopImpersonation();
    } catch {
      setExiting(false);
    }
  };

  return (
    <div
      className={cn(
        'border-b backdrop-blur-sm transition-all duration-200',
        embedded ? 'w-full' : 'sticky top-16 z-20',
        'bg-gradient-to-r from-rose-900/95 via-rose-800/95 to-rose-900/95 text-rose-50 border-rose-950/30',
      )}
      role="status"
      aria-live="polite"
    >
      <div className={TOP_STRIP_ROW_CLASS}>
        <TopStripBadge
          label="Preview"
          pulse
          dotClassName="bg-rose-300"
          className="sm:hidden"
        />
        <TopStripBadge
          label="Preview"
          pulse
          dotClassName="bg-rose-300"
          className="hidden sm:flex"
        />

        <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch px-2 text-[10px] leading-none sm:px-3 sm:text-[11px]">
          <span className="truncate">
            Previewing as <span className="font-semibold">{name}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={handleExit}
          disabled={exiting}
          className="flex h-8 shrink-0 items-center gap-1.5 self-stretch border-l border-white/10 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          <LogOut className="h-3 w-3" />
          {exiting ? 'Exiting…' : 'Exit preview'}
        </button>
      </div>
    </div>
  );
}
