import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Activity, ArrowRight, Info, TrendingUp, Users } from 'lucide-react';
import db from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  glassDialogMutedText,
  glassDialogTitleText,
  glassPanelStyles,
} from '@/components/layout/glassStyles';
import { getEnvironmentBadge } from '@/lib/applicationEnvironment';
import { canViewApplicationUsageForApp } from '@/lib/applicationUsage';
import { useAuth } from '@/lib/AuthContext';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import { toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

function SectionLabel({ children }) {
  return (
    <p className={cn('text-xs font-medium uppercase tracking-wide', glassDialogMutedText)}>
      {children}
    </p>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
      <p className={cn('text-[10px] font-medium uppercase tracking-wide', glassDialogMutedText)}>
        {label}
      </p>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums leading-none', glassDialogTitleText)}>
        {value}
      </p>
    </div>
  );
}

function UsageSparkline({ points = [], valueKey = 'launches' }) {
  const values = points.map((point) => Number(point?.[valueKey] ?? 0));
  const width = 280;
  const height = 48;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  if (values.length === 0) {
    return (
      <div className="flex h-12 items-center justify-center text-xs text-muted-foreground">
        No activity in this period
      </div>
    );
  }

  const coords = values.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const areaPath = `M0,${height} L${coords.join(' L')} L${width},${height} Z`;
  const linePath = `M${coords.join(' L')}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-12 w-full text-primary"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={areaPath} fill="currentColor" opacity="0.12" />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function sumLaunches(daily = [], days = 7) {
  const slice = daily.slice(-days);
  return slice.reduce((total, point) => total + Number(point?.launches ?? 0), 0);
}

function PersonalUsageSection({ applicationId, enabled }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['application-my-usage', applicationId],
    queryFn: () => db.getMyApplicationUsage(applicationId),
    enabled: enabled && Boolean(applicationId),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <SectionLabel>Your activity</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  const neverLaunched = !data.last_opened_at && Number(data.launches_all_time) === 0;
  const lastOpened = data.last_opened_at
    ? formatDistanceToNow(new Date(data.last_opened_at), { addSuffix: true })
    : null;

  return (
    <div className="space-y-2.5">
      <SectionLabel>Your activity</SectionLabel>
      {neverLaunched ? (
        <p className={cn('text-sm', glassDialogMutedText)}>
          You haven&apos;t opened this app yet
        </p>
      ) : (
        <>
          {lastOpened && (
            <p className={cn('text-sm', glassDialogTitleText)}>
              Last opened{' '}
              <span className="font-medium">{lastOpened}</span>
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="7 days" value={data.launches_7d ?? 0} />
            <StatTile label="30 days" value={data.launches_30d ?? 0} />
            <StatTile label="All time" value={data.launches_all_time ?? 0} />
          </div>
        </>
      )}
    </div>
  );
}

function TeamUsageSection({ application, enabled }) {
  const applicationId = application?.id;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['application-usage-detail', applicationId],
    queryFn: () => db.getApplicationUsageStats(applicationId),
    enabled: enabled && Boolean(applicationId),
    staleTime: 60_000,
  });

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <SectionLabel>Team usage</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  const sparklinePoints = (data?.trend?.daily ?? []).slice(-14);
  const launches7d = sumLaunches(data?.trend?.daily ?? [], 7);
  const launches30d = sumLaunches(data?.trend?.daily ?? [], 30);
  const eligible = Number(data.eligible_users ?? 0);
  const wau = Number(data.wau ?? 0);
  const mau = Number(data.mau ?? 0);
  const adoption = eligible > 0 ? Math.round((wau / eligible) * 100) : 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Team usage</SectionLabel>
        <span className={cn('flex items-center gap-1 text-[10px]', glassDialogMutedText)}>
          <Users className="h-3 w-3" />
          {eligible} eligible
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="WAU" value={wau} />
        <StatTile label="MAU" value={mau} />
        <StatTile label="Launches 7d" value={launches7d} />
        <StatTile label="Launches 30d" value={launches30d} />
      </div>

      <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className={cn('text-[10px] font-medium uppercase tracking-wide', glassDialogMutedText)}>
            Adoption (WAU)
          </p>
          <p className={cn('text-sm font-semibold tabular-nums', glassDialogTitleText)}>
            {adoption}%
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.min(adoption, 100)}%` }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
        <div className="mb-1 flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-primary" />
          <p className={cn('text-[10px] font-medium uppercase tracking-wide', glassDialogMutedText)}>
            Launches · 14 days
          </p>
        </div>
        <UsageSparkline points={sparklinePoints} valueKey="launches" />
      </div>

      <Button asChild variant="outline" size="sm" className="w-full justify-between">
        <Link to={`/applications/usage?app=${applicationId}`}>
          View full usage
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

export default function ApplicationDetailsSheet({ system, open, onOpenChange }) {
  const { user } = useAuth();

  if (!system) return null;

  const logoUrl = system.icon_url ? toAbsoluteUrl(system.icon_url) : null;
  const brandColor = system.color || DEFAULT_BRAND_COLOR;
  const description = system.description?.trim() || 'No description provided';
  const environmentBadge = getEnvironmentBadge(system.environment);
  const isOnline = system.status === 'online' && system.is_enabled;
  const showTeamUsage = canViewApplicationUsageForApp(user, system);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        overlayClassName="bg-black/25 backdrop-blur-sm"
        className={cn(
          'flex w-full flex-col gap-0 border-l p-0 sm:max-w-md',
          'rounded-bl-2xl sm:rounded-none',
          glassPanelStyles,
        )}
      >
        <SheetHeader className="border-b border-border/50 px-6 py-5 text-left">
          <SheetTitle className={cn('flex items-center gap-2', glassDialogTitleText)}>
            <Info className="h-4 w-4 text-primary" />
            About this app
          </SheetTitle>
          <SheetDescription className={glassDialogMutedText}>
            Full details for {system.name}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-start gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-black/10"
                style={{ backgroundColor: brandColor }}
              />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm ring-1 ring-black/10"
                style={{ backgroundColor: brandColor }}
              >
                {system.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className={cn('text-base font-semibold leading-snug', glassDialogTitleText)}>
                {system.name}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {environmentBadge && (
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {environmentBadge.label}
                  </Badge>
                )}
                {isOnline && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                  >
                    <Activity className="h-2.5 w-2.5" />
                    Active
                  </Badge>
                )}
                {!system.is_enabled && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-medium text-muted-foreground"
                  >
                    Disabled
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <SectionLabel>Description</SectionLabel>
            <p className={cn('whitespace-pre-wrap text-sm leading-relaxed', glassDialogTitleText)}>
              {description}
            </p>
          </div>

          <PersonalUsageSection applicationId={system.id} enabled={open} />

          <TeamUsageSection application={system} enabled={open && showTeamUsage} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
