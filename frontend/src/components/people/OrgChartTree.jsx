import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Maximize2, Minimize2, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';
import {
  collectAncestorIds,
  collectManagerIds,
  personMatchesQuery,
  walkOrgTree,
} from '@/components/people/orgChartUtils';

const CARD_WIDTH_CLASS = 'w-[200px]';
const CARD_HEIGHT_CLASS = 'h-[11.25rem]';
const CONNECTOR_H = 'h-12';
const DROP_H = 'h-6';
const LINE = 'bg-primary/40';
const DEPT_HUES = [206, 162, 32, 272, 345, 190, 248, 18, 150, 220];
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.1;

function departmentHue(name) {
  if (!name) return null;
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return DEPT_HUES[Math.abs(hash) % DEPT_HUES.length];
}

function deptColor(hue, alpha = 1) {
  if (hue == null) return null;
  if (alpha === 1) return `hsl(${hue} 62% 46%)`;
  return `hsl(${hue} 62% 46% / ${alpha})`;
}

function clampZoom(value) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10));
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function enterFullscreen(el) {
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
}

async function exitFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
}

function useCanvasPan(ref, enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    const onPointerDown = (event) => {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      if (event.target.closest('a, button, input, [role="combobox"]')) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      scrollLeft = el.scrollLeft;
      scrollTop = el.scrollTop;
      el.setPointerCapture(event.pointerId);
      el.style.cursor = 'grabbing';
    };

    const onPointerMove = (event) => {
      if (!dragging) return;
      el.scrollLeft = scrollLeft - (event.clientX - startX);
      el.scrollTop = scrollTop - (event.clientY - startY);
    };

    const stop = (event) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = '';
      if (el.hasPointerCapture?.(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('lostpointercapture', stop);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
      el.removeEventListener('lostpointercapture', stop);
    };
  }, [ref, enabled]);
}

function PersonCard({
  user,
  isRoot,
  isCurrentUser,
  isMatch,
  isFocused,
  isDimmed,
}) {
  const hue = departmentHue(user.department);
  const name = getDisplayName(user);
  const accent = deptColor(hue);
  const title = user.job_title?.trim();
  const department = user.department?.trim();

  return (
    <Link
      to={`/people/${user.id}`}
      data-org-user-id={String(user.id)}
      title={[name, title, department].filter(Boolean).join(' · ')}
      className={cn(
        'group relative z-[1] flex shrink-0 flex-col items-center rounded-2xl border border-border/80 bg-card px-3 pb-3 pt-3.5 text-center shadow-sm transition-colors',
        CARD_WIDTH_CLASS,
        CARD_HEIGHT_CLASS,
        'hover:border-primary/35 hover:bg-primary/[0.02] hover:shadow-md',
        isRoot && 'border-primary/25 bg-gradient-to-b from-primary/[0.07] to-card shadow-md',
        isCurrentUser && !isFocused && 'border-success/35',
        isMatch && 'border-primary ring-2 ring-primary/25',
        isFocused && 'border-primary ring-2 ring-primary/40 shadow-lg',
        isDimmed && 'opacity-40 hover:opacity-100'
      )}
    >
      {accent ? (
        <span
          className="absolute inset-x-8 top-0 h-[3px] rounded-b-full"
          style={{ background: accent }}
          aria-hidden
        />
      ) : null}

      {isCurrentUser ? (
        <span className="absolute right-2 top-2 rounded-full bg-success px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-success-foreground shadow-sm">
          You
        </span>
      ) : null}

      <span
        className="flex rounded-full p-[3px] shadow-sm"
        style={{
          background: isRoot
            ? 'linear-gradient(135deg, hsl(var(--primary) / 0.55), hsl(var(--primary) / 0.08))'
            : accent
              ? `linear-gradient(135deg, ${accent}, ${deptColor(hue, 0.12)})`
              : 'hsl(var(--border))',
        }}
      >
        <UserAvatar user={user} className="h-11 w-11 ring-2 ring-card" showStars={false} />
      </span>

      <p className="mt-2.5 line-clamp-2 min-h-[2.5rem] w-full text-[13px] font-semibold leading-snug group-hover:text-primary">
        {name}
      </p>

      <p
        className={cn(
          'mt-0.5 line-clamp-2 min-h-[2rem] w-full text-[11px] leading-snug',
          title ? 'text-muted-foreground' : 'italic text-muted-foreground/70'
        )}
      >
        {title || 'No title set'}
      </p>

      {department ? (
        <span
          className={cn(
            'mt-auto max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium text-foreground/75',
            !accent && 'bg-muted'
          )}
          style={accent ? { backgroundColor: deptColor(hue, 0.14) } : undefined}
        >
          {department}
        </span>
      ) : (
        <span className="mt-auto h-[22px]" aria-hidden />
      )}
    </Link>
  );
}

function ReportBadge({ count, collapsed, onToggle }) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={
        collapsed
          ? `Show ${count} direct report${count === 1 ? '' : 's'}`
          : `Hide ${count} direct report${count === 1 ? '' : 's'}`
      }
      onClick={onToggle}
      className={cn(
        'relative z-10 flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full border bg-background px-1.5 text-[10px] font-semibold tabular-nums shadow-sm transition-colors',
        'text-muted-foreground hover:border-primary hover:text-primary',
        collapsed && 'border-primary/40 text-primary'
      )}
    >
      {collapsed ? <Plus className="h-2.5 w-2.5" /> : null}
      {count}
    </button>
  );
}

function BranchList({ reports, nodeProps }) {
  return (
    <ul className="m-0 flex list-none items-start justify-center p-0">
      {reports.map((child, index) => {
        const isFirst = index === 0;
        const isLast = index === reports.length - 1;
        return (
          <li
            key={child.user.id}
            className="relative flex flex-col items-center px-2.5 pt-6"
          >
            <span
              className={cn('pointer-events-none absolute left-1/2 top-0 w-px -translate-x-1/2', DROP_H, LINE)}
              aria-hidden
            />
            {!isFirst ? (
              <span
                className={cn('pointer-events-none absolute left-0 right-1/2 top-0 h-px', LINE)}
                aria-hidden
              />
            ) : null}
            {!isLast ? (
              <span
                className={cn('pointer-events-none absolute left-1/2 right-0 top-0 h-px', LINE)}
                aria-hidden
              />
            ) : null}
            <OrgChartNode branch={child} {...nodeProps} />
          </li>
        );
      })}
    </ul>
  );
}

function OrgChartNode({
  branch,
  isRoot,
  collapsedIds,
  onToggleCollapse,
  currentUserId,
  matchIds,
  focusedUserId,
  dimUnmatched,
}) {
  const user = branch?.user;
  if (!user) return null;

  const reports = Array.isArray(branch.reports) ? branch.reports : [];
  const hasReports = reports.length > 0;
  const collapsed = hasReports && collapsedIds.has(String(user.id));
  const visibleReports = collapsed ? [] : reports;
  const isMatch = matchIds.has(String(user.id));
  const isCurrentUser = currentUserId != null && String(currentUserId) === String(user.id);
  const nodeProps = {
    collapsedIds,
    onToggleCollapse,
    currentUserId,
    matchIds,
    focusedUserId,
    dimUnmatched,
  };

  return (
    <div className="inline-flex flex-col items-center">
      <PersonCard
        user={user}
        isRoot={isRoot}
        isCurrentUser={isCurrentUser}
        isMatch={isMatch}
        isFocused={focusedUserId != null && String(focusedUserId) === String(user.id)}
        isDimmed={dimUnmatched && !isMatch}
      />

      {hasReports ? (
        <>
          <div className={cn('relative flex shrink-0 items-center justify-center', CONNECTOR_H)}>
            <span
              className={cn(
                'pointer-events-none absolute left-1/2 w-px -translate-x-1/2',
                LINE,
                collapsed ? 'top-0 h-6' : 'inset-y-0'
              )}
              aria-hidden
            />
            <ReportBadge
              count={reports.length}
              collapsed={collapsed}
              onToggle={() => onToggleCollapse(String(user.id))}
            />
          </div>

          {visibleReports.length === 1 ? (
            <OrgChartNode branch={visibleReports[0]} {...nodeProps} />
          ) : visibleReports.length > 1 ? (
            <BranchList reports={visibleReports} nodeProps={nodeProps} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function CanvasControls({ zoom, onZoomIn, onZoomOut, onResetZoom, isFullscreen, onToggleFullscreen }) {
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border bg-card/95 p-1 shadow-md backdrop-blur">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <button
        type="button"
        onClick={onResetZoom}
        title="Reset zoom"
        className="h-8 min-w-12 rounded-md px-1.5 text-xs font-medium tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}

const OrgChartTree = React.forwardRef(function OrgChartTree(
  {
    tree,
    currentUserId = null,
    searchQuery = '',
    focusedUserId = null,
    focusNonce = 0,
    emptyAction = null,
  },
  ref
) {
  const shellRef = useRef(null);
  const canvasRef = useRef(null);
  const branches = Array.isArray(tree) ? tree : [];
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useCanvasPan(canvasRef, branches.length > 0);

  const query = searchQuery.trim().toLowerCase();

  const matchIds = useMemo(() => {
    const ids = new Set();
    if (!query) return ids;
    walkOrgTree(branches, (branch) => {
      if (personMatchesQuery(branch.user, query)) ids.add(String(branch.user.id));
    });
    return ids;
  }, [branches, query]);

  useEffect(() => {
    setCollapsedIds(new Set());
    setZoom(1);
  }, [branches]);

  useEffect(() => {
    if (matchIds.size === 0) return;
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      matchIds.forEach((id) => {
        collectAncestorIds(branches, id).forEach((ancestorId) => next.delete(ancestorId));
      });
      return next;
    });
  }, [branches, matchIds]);

  const onToggleCollapse = useCallback((userId) => {
    const id = String(userId);
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const zoomIn = useCallback(() => setZoom((value) => clampZoom(value + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((value) => clampZoom(value - ZOOM_STEP)), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!getFullscreenElement()) {
        await enterFullscreen(el);
      } else {
        await exitFullscreen();
      }
    } catch {
      // Browser may block fullscreen without a user gesture.
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const fsEl = getFullscreenElement();
      setIsFullscreen(Boolean(fsEl && (fsEl === shellRef.current || fsEl.contains?.(shellRef.current))));
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || branches.length === 0) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((value) => clampZoom(value + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [branches.length]);

  useImperativeHandle(
    ref,
    () => ({
      expandAll() {
        setCollapsedIds(new Set());
      },
      collapseTeams() {
        setCollapsedIds(new Set(collectManagerIds(branches)));
      },
      zoomIn,
      zoomOut,
      resetZoom,
      toggleFullscreen,
    }),
    [branches, zoomIn, zoomOut, resetZoom, toggleFullscreen]
  );

  useEffect(() => {
    if (focusedUserId == null) return undefined;
    const ancestors = collectAncestorIds(branches, focusedUserId);
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      ancestors.forEach((id) => next.delete(String(id)));
      next.delete(String(focusedUserId));
      return next;
    });

    const timer = window.setTimeout(() => {
      const node = canvasRef.current?.querySelector(`[data-org-user-id="${String(focusedUserId)}"]`);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 60);

    return () => window.clearTimeout(timer);
  }, [branches, focusedUserId, focusNonce]);

  useEffect(() => {
    if (matchIds.size === 0) return undefined;
    const firstId = [...matchIds][0];
    const timer = window.setTimeout(() => {
      const node = canvasRef.current?.querySelector(`[data-org-user-id="${firstId}"]`);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [matchIds]);

  if (branches.length === 0) {
    return (
      <EmptyState
        variant="dashed"
        icon={GitBranch}
        title="No reporting structure yet"
        description="Assign managers in User Management to build the org chart."
        action={emptyAction}
        className="h-full min-h-[16rem]"
      />
    );
  }

  return (
    <div
      ref={shellRef}
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/40',
        isFullscreen && 'h-screen w-screen rounded-none bg-background'
      )}
    >
      <div
        ref={canvasRef}
        className="h-full min-h-0 cursor-grab select-none overflow-auto overscroll-contain [scrollbar-gutter:stable]"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        <div className="inline-block min-h-full min-w-full" style={{ zoom }}>
          <div className="mx-auto flex min-h-full min-w-max items-start justify-center px-8 py-10">
            {branches.map((branch) => (
              <OrgChartNode
                key={branch.user.id}
                branch={branch}
                isRoot
                collapsedIds={collapsedIds}
                onToggleCollapse={onToggleCollapse}
                currentUserId={currentUserId}
                matchIds={matchIds}
                focusedUserId={focusedUserId}
                dimUnmatched={query.length > 0}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-20 sm:bottom-4 sm:right-4">
        <CanvasControls
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetZoom={resetZoom}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    </div>
  );
});

OrgChartTree.displayName = 'OrgChartTree';

export default OrgChartTree;

export function OrgChartSkeleton() {
  return (
    <div
      className="flex h-full min-h-[16rem] items-start justify-center overflow-hidden rounded-2xl border border-border bg-card/40 px-8 py-10"
      style={{
        backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="flex flex-col items-center">
        <div className="h-[11.25rem] w-[200px] animate-pulse rounded-2xl bg-muted/80" />
        <div className="h-12 w-px bg-primary/20" />
        <div className="flex">
          <div className="px-2.5">
            <div className="h-[11.25rem] w-[200px] animate-pulse rounded-2xl bg-muted/70" />
          </div>
          <div className="px-2.5">
            <div className="h-[11.25rem] w-[200px] animate-pulse rounded-2xl bg-muted/70" />
          </div>
          <div className="hidden px-2.5 sm:block">
            <div className="h-[11.25rem] w-[200px] animate-pulse rounded-2xl bg-muted/70" />
          </div>
        </div>
      </div>
    </div>
  );
}
