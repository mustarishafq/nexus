import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { APPLICATION_TILE_ICON_CLASS } from '@/lib/applicationIcon';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import { toAbsoluteUrl } from '@/lib/media';

export function LaunchAppBadge({ application, size = 'lg', className }) {
  const logoUrl = application?.icon_url ? toAbsoluteUrl(application.icon_url) : null;
  const brandColor = application?.color || DEFAULT_BRAND_COLOR;
  const dimension = size === 'sm' ? 'h-12 w-12' : size === 'md' ? 'h-16 w-16' : 'h-24 w-24';
  const textSize = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-4xl';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/20 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/10',
        dimension,
        className,
      )}
      style={{ backgroundColor: brandColor }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/20" />
      {logoUrl ? (
        <img src={logoUrl} alt={application?.name || 'Application'} className={cn('relative z-[1]', APPLICATION_TILE_ICON_CLASS)} />
      ) : (
        <div className="relative z-[1] flex h-full w-full items-center justify-center">
          <span className={cn('font-bold text-white/95', textSize)}>
            {application?.name?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
      )}
    </div>
  );
}

export function LaunchTitle({ application }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-1 text-center"
    >
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Launching</p>
      <h2 className="text-lg font-semibold text-white sm:text-xl">{application?.name}</h2>
    </motion.div>
  );
}

export function LaunchHint({ children, className }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className={cn('text-center text-xs text-white/70', className)}
    >
      {children}
    </motion.p>
  );
}
