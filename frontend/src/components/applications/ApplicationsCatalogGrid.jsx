import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bell,
  Bot,
  Calendar as CalendarIcon,
  ExternalLink,
  Info,
  KeyRound,
  Monitor,
  Pencil,
  Play,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import ApplicationCard from '@/components/applications/ApplicationCard';
import ApplicationDetailsSheet from '@/components/applications/ApplicationDetailsSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { APPLICATION_TILE_ICON_CLASS } from '@/lib/applicationIcon';
import { getEnvironmentBadge } from '@/lib/applicationEnvironment';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import { toAbsoluteUrl } from '@/lib/media';
import { applicationCalendarSyncEnabled } from '@/lib/calendarEventMapping';
import { applicationNotificationsEnabled } from '@/lib/notificationEventMapping';
import { getApplicationStatus } from '@/lib/applicationStatus';
import { cn } from '@/lib/utils';

function CatalogSkeleton({ viewMode }) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
          >
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="hidden h-8 w-20 animate-pulse rounded-lg bg-muted sm:block" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/70 bg-card p-2.5 sm:p-3"
        >
          <div className="aspect-square animate-pulse rounded-xl bg-muted/70" />
          <div className="mt-3 space-y-2 px-0.5">
            <div className="mx-auto h-3 w-[70%] animate-pulse rounded bg-muted/70" />
            <div className="mx-auto h-2.5 w-full animate-pulse rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ApplicationListRow({
  system,
  index,
  canManageSystem,
  launching,
  onLaunch,
  onEdit,
  onDelete,
  onManageSsoCredentials,
  onWhatsNew,
  unreadReleaseNotes = 0,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const logoUrl = system.icon_url ? toAbsoluteUrl(system.icon_url) : null;
  const brandColor = system.color || DEFAULT_BRAND_COLOR;
  const status = getApplicationStatus(system.status);
  const StatusIcon = status.icon;
  const environmentBadge = getEnvironmentBadge(system.environment);
  const notificationsEnabled = applicationNotificationsEnabled(system);
  const calendarSyncEnabled = applicationCalendarSyncEnabled(system);
  const mcpEnabled = Boolean(system.mcp_enabled);
  const isInteractive = Boolean(system.is_enabled && onLaunch);
  const isLaunching = launching === system.id;
  const description = system.description?.trim() || 'No description provided';

  const handleLaunch = (event, openMode) => {
    event?.stopPropagation?.();
    if (!isInteractive || isLaunching) return;
    onLaunch(system, openMode ? { openMode } : undefined);
  };

  return (
    <>
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: Math.min(index, 8) * 0.03, type: 'spring', stiffness: 360, damping: 28 }}
      whileHover={isInteractive ? { y: -2 } : undefined}
      className={cn(
        'group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors sm:gap-4 sm:p-3.5',
        isInteractive && 'cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02]',
        !system.is_enabled && 'opacity-60'
      )}
      onClick={isInteractive ? (event) => handleLaunch(event) : undefined}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 opacity-80"
        style={{ backgroundColor: brandColor }}
      />

      <div
        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 shadow-sm ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-[1.04] sm:h-16 sm:w-16"
        style={{ backgroundColor: brandColor }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className={cn('h-full w-full object-cover', APPLICATION_TILE_ICON_CLASS)} />
        ) : (
          <span className="text-lg font-bold text-white/90">{system.name?.[0]?.toUpperCase()}</span>
        )}
        {isLaunching ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{system.name}</h3>
          <Badge className={cn('border-0 text-[10px]', status.bg, status.color)}>
            <StatusIcon className="mr-1 h-2.5 w-2.5" />
            {status.label}
          </Badge>
          {environmentBadge ? (
            <Badge variant="outline" className="text-[10px]">
              {environmentBadge.label}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground sm:line-clamp-2">{description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {notificationsEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
              <Bell className="h-2.5 w-2.5" /> Notify
            </span>
          ) : null}
          {calendarSyncEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-700 dark:text-sky-300">
              <CalendarIcon className="h-2.5 w-2.5" /> Calendar
            </span>
          ) : null}
          {mcpEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-700 dark:text-violet-300">
              <Bot className="h-2.5 w-2.5" /> MCP
            </span>
          ) : null}
          {system.status === 'online' && system.is_enabled ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
              <Activity className="h-2.5 w-2.5" /> Active
            </span>
          ) : null}
        </div>
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`About ${system.name}`}
                onClick={() => setDetailsOpen(true)}
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>About</TooltipContent>
          </Tooltip>

          {system.auth_mode === 'jwt' && onManageSsoCredentials ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 lg:inline-flex"
              title="Manage SSO accounts"
              onClick={() => onManageSsoCredentials(system)}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </Button>
          ) : null}

          {onWhatsNew ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative h-8 w-8"
              title="What's New"
              onClick={() => onWhatsNew(system)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {unreadReleaseNotes > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold text-primary-foreground">
                  {unreadReleaseNotes > 9 ? '9+' : unreadReleaseNotes}
                </span>
              ) : null}
            </Button>
          ) : null}

          {canManageSystem && onEdit && onDelete ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Edit"
                onClick={() => onEdit(system)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                title="Delete"
                onClick={() => onDelete(system)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null}

          {isInteractive ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 sm:inline-flex"
                title="Open in new tab"
                disabled={isLaunching}
                onClick={(event) => handleLaunch(event, 'new_tab')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5"
                disabled={isLaunching}
                onClick={(event) => handleLaunch(event)}
              >
                <Play className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open</span>
              </Button>
            </>
          ) : null}
        </div>
      </TooltipProvider>
    </motion.article>
    <ApplicationDetailsSheet
      system={system}
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
    />
    </>
  );
}

export default function ApplicationsCatalogGrid({
  systems,
  isLoading,
  viewMode = 'grid',
  hasFilters,
  onClearFilters,
  currentUser,
  launching,
  releaseNoteUnreadCounts = {},
  onLaunch,
  onEdit,
  onDelete,
  onManageSsoCredentials,
  onWhatsNew,
  onAdd,
}) {
  if (isLoading) {
    return <CatalogSkeleton viewMode={viewMode} />;
  }

  if (systems.length === 0 && hasFilters) {
    return (
      <EmptyState
        icon={Search}
        title="No matching applications"
        description="Try a different search term or clear the status filter."
        action={
          onClearFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null
        }
      />
    );
  }

  if (systems.length === 0) {
    return (
      <EmptyState
        icon={Monitor}
        title="No applications"
        description={
          currentUser?.role === 'admin'
            ? 'Register your first system to get started.'
            : 'You have not been granted access to any systems yet.'
        }
        action={
          currentUser?.role === 'admin' && onAdd ? (
            <Button type="button" size="sm" className="gap-1.5" onClick={onAdd}>
              Add application
            </Button>
          ) : null
        }
      />
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {systems.map((system, index) => {
            const canManageSystem =
              currentUser?.role === 'admin'
              || Number(system.created_by_user_id) === Number(currentUser?.id);

            return (
              <ApplicationListRow
                key={system.id}
                system={system}
                index={index}
                canManageSystem={canManageSystem}
                launching={launching}
                onLaunch={onLaunch}
                onEdit={onEdit}
                onDelete={onDelete}
                onManageSsoCredentials={onManageSsoCredentials}
                onWhatsNew={onWhatsNew}
                unreadReleaseNotes={Number(releaseNoteUnreadCounts?.[String(system.id)] || 0)}
              />
            );
          })}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-border bg-card/60 p-3 sm:p-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <AnimatePresence mode="popLayout">
          {systems.map((system, index) => {
            const canManageSystem =
              currentUser?.role === 'admin'
              || Number(system.created_by_user_id) === Number(currentUser?.id);

            return (
              <motion.div
                key={system.id}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ delay: Math.min(index, 10) * 0.035, type: 'spring', stiffness: 340, damping: 26 }}
                className={cn(
                  'group/catalog rounded-2xl border border-border/80 bg-background/70 p-2.5 shadow-sm',
                  'transition-all duration-300',
                  'hover:-translate-y-1 hover:border-primary/30 hover:bg-background hover:shadow-lg',
                  'sm:p-3'
                )}
              >
                <ApplicationCard
                  system={system}
                  index={0}
                  canManageSystem={canManageSystem}
                  launching={launching}
                  footerOutside
                  onLaunch={onLaunch}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onManageSsoCredentials={onManageSsoCredentials}
                  onWhatsNew={onWhatsNew}
                  unreadReleaseNotes={Number(releaseNoteUnreadCounts?.[String(system.id)] || 0)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
