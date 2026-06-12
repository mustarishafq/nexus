import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import CornerRibbon from '@/components/applications/CornerRibbon';
import { cn } from '@/lib/utils';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import useDominantImageColor from '@/hooks/useDominantImageColor';
import { getEnvironmentBadge } from '@/lib/applicationEnvironment';
import { toAbsoluteUrl } from '@/lib/media';

const hoverRevealClass =
  'opacity-0 transition-all duration-300 ease-out group-hover:opacity-100 group-focus-within:opacity-100';

export default function ApplicationCard({
  system,
  index = 0,
  canManageSystem,
  launching,
  onLaunch,
  onEdit,
  onDelete,
  footerSubtitle,
  readOnly = false,
  footerAlwaysVisible = false,
  footerOutside = false,
}) {
  const logoUrl = system.icon_url ? toAbsoluteUrl(system.icon_url) : null;
  const extractedColor = useDominantImageColor(
    system.icon_url,
    system.color || DEFAULT_BRAND_COLOR
  );
  const brandColor = system.icon_url ? extractedColor : (system.color || DEFAULT_BRAND_COLOR);
  const isOnline = system.status === 'online';
  const environmentBadge = getEnvironmentBadge(system.environment);
  const isInteractive = !readOnly && system.is_enabled && onLaunch;
  const footerDetail = footerSubtitle ?? (system.description?.trim() || 'No description provided');
  const showOverlayFooter = !footerOutside;

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 320, damping: 26 }}
      whileHover={isInteractive && !footerOutside ? { y: -4, scale: 1.03 } : isInteractive ? { y: -2 } : undefined}
      whileTap={isInteractive ? { scale: 0.97, y: -2 } : undefined}
      style={{
        backgroundColor: brandColor,
        '--app-glow': brandColor,
      }}
      aria-label={footerOutside ? undefined : system.name}
      tabIndex={footerOutside ? undefined : isInteractive ? 0 : undefined}
      className={cn(
        'group relative aspect-square w-full overflow-hidden rounded-xl border border-white/15',
        'shadow-[0_8px_20px_-10px_rgba(0,0,0,0.35)] ring-1 ring-black/10',
        'transition-[box-shadow,filter] duration-300',
        isInteractive && 'hover:border-white/25 hover:shadow-[0_18px_36px_-14px_color-mix(in_srgb,var(--app-glow)_55%,transparent),0_10px_24px_-12px_rgba(0,0,0,0.35)] hover:brightness-[1.03]',
        !footerOutside && (readOnly ? 'cursor-default' : system.is_enabled ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed')
      )}
      onClick={footerOutside ? undefined : isInteractive ? () => onLaunch(system) : undefined}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {logoUrl ? (
        <img
          src={logoUrl}
          alt={system.name}
          className="relative z-[1] h-full w-full object-contain transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.06]"
        />
      ) : (
        <div className="relative z-[1] flex h-full w-full items-center justify-center transition-transform duration-300 ease-out group-hover:scale-110">
          <span className="text-2xl font-bold text-white/90 drop-shadow-sm">{system.name?.[0]?.toUpperCase()}</span>
        </div>
      )}

      {launching === system.id && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      )}

      {environmentBadge && (
        <CornerRibbon
          label={environmentBadge.label}
          ribbonClassName={environmentBadge.ribbonClassName}
        />
      )}

      {isOnline && system.is_enabled && (
        <span className="pointer-events-none absolute bottom-2 right-2 z-[1] flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        </span>
      )}

      {canManageSystem && onEdit && onDelete && (
        <div className={cn('absolute inset-0 z-[2] pointer-events-none', hoverRevealClass)}>
          <div className="pointer-events-auto absolute top-2 right-2 z-10 flex translate-y-1 items-center gap-0.5 rounded-lg border border-white/20 bg-black/55 p-0.5 shadow-lg transition-transform duration-300 group-hover:translate-y-0">
            <Badge variant="outline" className="h-5 border-white/25 bg-white/10 text-[9px] text-white">
              {system.auth_mode === 'redirect' ? 'Redirect' : 'JWT'}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white hover:bg-white/15 hover:text-white"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(system);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-300 hover:bg-red-500/20 hover:text-red-200"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(system);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {showOverlayFooter && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 z-[2] border-t border-white/25 bg-black/65 px-2.5 py-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
            footerAlwaysVisible
              ? 'translate-y-0'
              : cn(hoverRevealClass, 'translate-y-2 transition-transform duration-300 group-hover:translate-y-0')
          )}
        >
          <h3 className="line-clamp-2 text-xs font-semibold leading-snug">{system.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/70">{footerDetail}</p>
        </div>
      )}
    </motion.div>
  );

  if (footerOutside) {
    const Wrapper = isInteractive ? 'button' : 'div';

    return (
      <Wrapper
        type={isInteractive ? 'button' : undefined}
        aria-label={system.name}
        disabled={isInteractive ? launching === system.id : undefined}
        onClick={isInteractive ? () => onLaunch(system) : undefined}
        className={cn(
          'group/tile flex w-full flex-col items-center gap-1 text-center',
          isInteractive && system.is_enabled ? 'cursor-pointer' : 'cursor-default',
          !system.is_enabled && 'opacity-60'
        )}
      >
        {card}
        <div className="min-w-0 w-full px-0.5 pt-2 text-center">
          <p className="line-clamp-2 text-xs font-semibold leading-tight">{system.name}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{footerDetail}</p>
        </div>
      </Wrapper>
    );
  }

  return card;
}
