// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Monitor,
  Users,
  Search,
  TrendingUp,
  UserX,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react';
import ApplicationsNav from '@/components/applications/ApplicationsNav';
import ApplicationUsageCharts from '@/components/applications/ApplicationUsageCharts';
import StatsCard from '@/components/dashboard/StatsCard';
import UserAvatar from '@/components/users/UserAvatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useMetaTags } from '@/hooks/useMetaTags';
import { canViewApplicationUsage, getManageableApplications } from '@/lib/applicationUsage';

const PERIOD_TABS = [
  { value: 'wau', label: 'Weekly (7d)', shortLabel: 'WAU' },
  { value: 'mau', label: 'Monthly (30d)', shortLabel: 'MAU' },
];

const USER_VIEW_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const SORT_OPTIONS = {
  active: [
    { value: 'launches-desc', label: 'Most launches' },
    { value: 'last_active-desc', label: 'Recently active' },
    { value: 'last_active-asc', label: 'Least recently active' },
    { value: 'name-asc', label: 'Name (A–Z)' },
  ],
  inactive: [
    { value: 'status-asc', label: 'Never launched first' },
    { value: 'last_active-asc', label: 'Longest lapsed' },
    { value: 'last_active-desc', label: 'Recently lapsed' },
    { value: 'launches-desc', label: 'Most past launches' },
    { value: 'name-asc', label: 'Name (A–Z)' },
  ],
};

const PAGE_SIZE = 20;

function filterUsersBySearch(users, search) {
  const term = search.trim().toLowerCase();
  if (!term) return users;

  return users.filter((row) => {
    const haystack = [row.full_name, row.email, row.user_id]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

function sortUsageUsers(users, sortKey, userView) {
  const [sortBy, sortDir] = sortKey.split('-');
  const dir = sortDir === 'asc' ? 1 : -1;

  return [...users].sort((a, b) => {
    if (userView === 'inactive' && sortBy === 'status') {
      if (a.never_launched !== b.never_launched) {
        return a.never_launched ? -1 : 1;
      }
      const aTime = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
      const bTime = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
      return (aTime - bTime) * dir;
    }

    if (sortBy === 'name') {
      const aName = (a.full_name || a.email || '').toLowerCase();
      const bName = (b.full_name || b.email || '').toLowerCase();
      return aName.localeCompare(bName) * dir;
    }

    if (sortBy === 'launches') {
      const aVal = userView === 'active' ? a.launch_count : (a.total_launch_count ?? 0);
      const bVal = userView === 'active' ? b.launch_count : (b.total_launch_count ?? 0);
      return (aVal - bVal) * dir;
    }

    const aTime = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
    const bTime = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
    return (aTime - bTime) * dir;
  });
}

function UsageUsersPagination({ page, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalItems === 0) return null;

  const currentPage = Math.min(page, totalPages);
  const rangeStart = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {rangeStart}-{rangeEnd} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground px-2">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function UsageUserIdentity({ row, compact = false }) {
  const profilePath = row.user_id ? `/people/${row.user_id}` : null;
  const displayName = row.full_name || row.email || row.user_id;

  const content = (
    <div className="flex items-center gap-3 min-w-0">
      <UserAvatar user={row} className="h-9 w-9" fallbackClassName="text-xs" />
      <div className="min-w-0">
        <p className={cn('font-medium text-sm truncate', profilePath && 'group-hover:text-primary transition-colors')}>
          {displayName}
        </p>
        {row.email ? (
          <p className={cn('text-xs text-muted-foreground truncate', compact ? '' : 'md:hidden')}>
            {row.email}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!profilePath) {
    return content;
  }

  return (
    <Link to={profilePath} className="group block min-w-0 rounded-lg -mx-1 px-1 py-0.5 hover:bg-muted/50 transition-colors">
      {content}
    </Link>
  );
}

function ActiveUserMobileCard({ row, isOverall }) {
  const lastActive = new Date(row.last_active_at);
  const firstActive = new Date(row.first_active_at);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <UsageUserIdentity row={row} compact />
      <div className="grid grid-cols-2 gap-2 text-xs">
        {isOverall ? (
          <div>
            <p className="text-muted-foreground">Apps used</p>
            <Badge variant="outline" className="mt-1 tabular-nums">{row.apps_used ?? 1}</Badge>
          </div>
        ) : null}
        <div>
          <p className="text-muted-foreground">Launches</p>
          <Badge variant="secondary" className="mt-1 tabular-nums">{row.launch_count}</Badge>
        </div>
        <div className={isOverall ? '' : 'col-span-2'}>
          <p className="text-muted-foreground">Last active</p>
          <p className="mt-1 font-medium">{format(lastActive, 'MMM d, yyyy')}</p>
          <p className="text-muted-foreground">{formatDistanceToNow(lastActive, { addSuffix: true })}</p>
        </div>
        <div className="col-span-2">
          <p className="text-muted-foreground">First active</p>
          <p className="mt-1">{format(firstActive, 'MMM d, yyyy')}</p>
        </div>
      </div>
    </div>
  );
}

function InactiveUserMobileCard({ row }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <UsageUserIdentity row={row} compact />
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px]',
            row.never_launched
              ? 'border-muted-foreground/30 text-muted-foreground'
              : 'border-warning/30 text-warning'
          )}
        >
          {row.never_launched ? 'Never launched' : 'Lapsed'}
        </Badge>
        <Badge variant="secondary" className="tabular-nums text-[10px]">
          {row.total_launch_count} launch{row.total_launch_count === 1 ? '' : 'es'}
        </Badge>
      </div>
      <div className="text-xs">
        <p className="text-muted-foreground">Last launch</p>
        {row.last_active_at ? (
          <>
            <p className="mt-1 font-medium">{format(new Date(row.last_active_at), 'MMM d, yyyy · h:mm a')}</p>
            <p className="text-muted-foreground">{formatDistanceToNow(new Date(row.last_active_at), { addSuffix: true })}</p>
          </>
        ) : (
          <p className="mt-1 text-muted-foreground">—</p>
        )}
      </div>
    </div>
  );
}

function FilterTabGroup({ tabs, value, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1 w-full sm:w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function ApplicationUsage() {
  const { user } = useAuth();
  const [selectedAppId, setSelectedAppId] = useState('overall');
  const [period, setPeriod] = useState('wau');
  const [userView, setUserView] = useState('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('launches-desc');

  const { data: systems = [], isLoading: loadingSystems } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list('sort_order', 50),
  });

  const manageableApps = useMemo(
    () => getManageableApplications(user, systems),
    [user, systems]
  );

  const showUsage = canViewApplicationUsage(user, systems);

  useEffect(() => {
    if (manageableApps.length === 0) {
      return;
    }

    if (selectedAppId === 'overall') {
      return;
    }

    const stillValid = manageableApps.some(
      (app) => String(app.id) === String(selectedAppId)
    );

    if (!stillValid) {
      setSelectedAppId('overall');
    }
  }, [manageableApps, selectedAppId]);

  const {
    data: usageDetail,
    isLoading: loadingUsage,
    isFetching: fetchingUsage,
    refetch: refetchUsage,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['application-usage-detail', selectedAppId],
    queryFn: () =>
      db.getApplicationUsageStats(selectedAppId === 'overall' ? null : selectedAppId),
    enabled: showUsage && manageableApps.length > 0,
    staleTime: 60_000,
  });

  const isOverall = selectedAppId === 'overall' || usageDetail?.scope === 'overall';
  const selectedApp = manageableApps.find(
    (app) => String(app.id) === String(selectedAppId)
  );
  const scopeLabel = isOverall
    ? `All applications (${usageDetail?.applications_tracked ?? manageableApps.length})`
    : selectedApp?.name || usageDetail?.application?.name || 'Application';

  const activeUsers = usageDetail?.users?.[period] || [];
  const inactiveUsers = usageDetail?.users?.[`inactive_${period}`] || [];
  const displayedUsers = userView === 'active' ? activeUsers : inactiveUsers;

  const wauCount = usageDetail?.wau ?? 0;
  const mauCount = usageDetail?.mau ?? 0;
  const wauInactiveCount = usageDetail?.wau_inactive ?? 0;
  const mauInactiveCount = usageDetail?.mau_inactive ?? 0;
  const eligibleCount = usageDetail?.eligible_users ?? 0;
  const activeCount = period === 'wau' ? wauCount : mauCount;
  const inactiveCount = period === 'wau' ? wauInactiveCount : mauInactiveCount;
  const stickiness = mauCount > 0 ? Math.round((wauCount / mauCount) * 100) : 0;
  const engagementRate = eligibleCount > 0 ? Math.round((activeCount / eligibleCount) * 100) : 0;
  const periodLabel = period === 'wau' ? 'weekly' : 'monthly';
  const periodDays = period === 'wau' ? 7 : 30;

  const filteredUsers = useMemo(() => {
    const searched = filterUsersBySearch(displayedUsers, search);
    return sortUsageUsers(searched, sortKey, userView);
  }, [displayedUsers, search, sortKey, userView]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(
    () => filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredUsers, currentPage]
  );

  useEffect(() => {
    setPage(1);
  }, [search, period, userView, selectedAppId, sortKey]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setSortKey(userView === 'active' ? 'launches-desc' : 'status-asc');
  }, [userView]);

  useMetaTags({
    title: 'Active Users - Applications - EMZI Nexus Brain',
    description: 'Monitor WAU and MAU with per-user launch activity',
  });

  if (!showUsage) {
    return <Navigate to="/applications" replace />;
  }

  const lastUpdatedLabel = dataUpdatedAt
    ? `Updated ${formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}`
    : null;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
            Application
          </h1>
          <div className="flex items-center justify-between gap-3">
            <ApplicationsNav showUsage />
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3 sm:gap-1.5 shrink-0"
              title="Refresh usage data"
              onClick={() => refetchUsage()}
              disabled={fetchingUsage}
            >
              <RefreshCw className={cn('w-4 h-4', fetchingUsage && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Track active and inactive users with access, based on app launches in Nexus
          </p>
          {lastUpdatedLabel ? (
            <p className="text-xs text-muted-foreground sm:text-sm">{lastUpdatedLabel}</p>
          ) : null}
        </div>
      </motion.div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Select value={selectedAppId} onValueChange={setSelectedAppId} disabled={manageableApps.length === 0}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Select scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overall">Overall (all applications)</SelectItem>
            {manageableApps.map((app) => (
              <SelectItem key={app.id} value={String(app.id)}>
                {app.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FilterTabGroup tabs={PERIOD_TABS} value={period} onChange={setPeriod} />
          <FilterTabGroup tabs={USER_VIEW_TABS} value={userView} onChange={setUserView} />
        </div>
      </div>

      {loadingSystems || (loadingUsage && !usageDetail) ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : manageableApps.length === 0 ? (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No applications available to monitor.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard
              title="Eligible Users"
              value={eligibleCount}
              subtitle={isOverall ? 'Unique users with access across all apps' : 'Users with access to this app'}
              icon={Users}
              color="bg-muted"
              index={0}
            />
            <button
              type="button"
              onClick={() => setUserView('active')}
              className="text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StatsCard
                title={period === 'wau' ? 'Weekly Active' : 'Monthly Active'}
                value={activeCount}
                subtitle={
                  eligibleCount > 0
                    ? `${engagementRate}% of eligible · launched in last ${periodDays} days`
                    : `Launched in the last ${periodDays} days`
                }
                icon={Users}
                color="bg-primary/10"
                index={1}
              />
            </button>
            <button
              type="button"
              onClick={() => setUserView('inactive')}
              className="text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StatsCard
                title={period === 'wau' ? 'Weekly Inactive' : 'Monthly Inactive'}
                value={inactiveCount}
                subtitle={
                  eligibleCount > 0
                    ? `${100 - engagementRate}% of eligible · have access but did not launch`
                    : 'Have access but did not launch'
                }
                icon={UserX}
                color="bg-warning/10"
                index={2}
              />
            </button>
            <StatsCard
              title="Weekly Stickiness"
              value={mauCount > 0 ? `${stickiness}%` : '—'}
              subtitle="WAU divided by MAU"
              icon={TrendingUp}
              color="bg-success/10"
              index={3}
            />
          </div>

          <ApplicationUsageCharts
            trendDaily={usageDetail?.trend?.daily ?? []}
            byApplication={usageDetail?.by_application ?? []}
            period={period}
            periodDays={periodDays}
            scopeLabel={scopeLabel}
            isOverall={isOverall}
          />

          {eligibleCount > 0 ? (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">
                  {period === 'wau' ? 'Weekly' : 'Monthly'} engagement
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {activeCount} of {eligibleCount} users ({engagementRate}%)
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${engagementRate}%` }}
                />
              </div>
            </div>
          ) : null}

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  {period === 'wau' ? 'Weekly' : 'Monthly'}{' '}
                  {userView === 'active' ? 'active' : 'inactive'} users
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {scopeLabel} · {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Select value={sortKey} onValueChange={setSortKey}>
                  <SelectTrigger className="w-full sm:w-48">
                    <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS[userView].map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-0 pb-0">
              {filteredUsers.length === 0 ? (
                <EmptyState
                  icon={userView === 'active' ? Users : UserX}
                  title={
                    search
                      ? 'No users match your search'
                      : userView === 'active'
                        ? `No ${periodLabel} active users yet`
                        : `No ${periodLabel} inactive users`
                  }
                  description={
                    search
                      ? 'Try a different name or email.'
                      : userView === 'active'
                        ? `No one with access has launched in the last ${periodDays} days.`
                        : 'Everyone with access has launched in this period.'
                  }
                  variant="compact"
                  className="py-16"
                />
              ) : (
                <>
                  <div className="space-y-3 px-6 pb-4 md:hidden">
                    {paginatedUsers.map((row) =>
                      userView === 'active' ? (
                        <ActiveUserMobileCard key={row.user_id} row={row} isOverall={isOverall} />
                      ) : (
                        <InactiveUserMobileCard key={row.user_id} row={row} />
                      )
                    )}
                  </div>

                  <div className="hidden md:block rounded-xl border border-border overflow-hidden mx-6 mb-0 [&>div]:max-h-[32rem] [&>div]:overflow-auto">
                    <Table>
                      <TableHeader className="bg-muted/40 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="pl-6">User</TableHead>
                          <TableHead className="hidden lg:table-cell">Email</TableHead>
                          {userView === 'active' && isOverall ? (
                            <TableHead className="hidden xl:table-cell">Apps used</TableHead>
                          ) : null}
                          {userView === 'inactive' ? <TableHead>Status</TableHead> : null}
                          <TableHead>{userView === 'active' ? 'Launches' : 'Total launches'}</TableHead>
                          {userView === 'active' ? (
                            <TableHead className="hidden lg:table-cell">First active</TableHead>
                          ) : null}
                          <TableHead className="pr-6">Last {userView === 'active' ? 'active' : 'launch'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((row) => {
                          if (userView === 'active') {
                            const lastActive = new Date(row.last_active_at);
                            const firstActive = new Date(row.first_active_at);

                            return (
                              <TableRow key={row.user_id} className="hover:bg-muted/30">
                                <TableCell className="pl-6">
                                  <UsageUserIdentity row={row} />
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                  {row.email || '—'}
                                </TableCell>
                                {isOverall ? (
                                  <TableCell className="hidden xl:table-cell">
                                    <Badge variant="outline" className="tabular-nums">
                                      {row.apps_used ?? 1}
                                    </Badge>
                                  </TableCell>
                                ) : null}
                                <TableCell>
                                  <Badge variant="secondary" className="tabular-nums">
                                    {row.launch_count}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                                  {format(firstActive, 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell className="text-sm whitespace-nowrap pr-6">
                                  <div>{format(lastActive, 'MMM d, yyyy · h:mm a')}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(lastActive, { addSuffix: true })}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return (
                            <TableRow key={row.user_id} className="hover:bg-muted/30">
                              <TableCell className="pl-6">
                                <UsageUserIdentity row={row} />
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                {row.email || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px]',
                                    row.never_launched
                                      ? 'border-muted-foreground/30 text-muted-foreground'
                                      : 'border-warning/30 text-warning'
                                  )}
                                >
                                  {row.never_launched ? 'Never launched' : 'Lapsed'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="tabular-nums">
                                  {row.total_launch_count}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm whitespace-nowrap pr-6">
                                {row.last_active_at ? (
                                  <>
                                    <div>{format(new Date(row.last_active_at), 'MMM d, yyyy · h:mm a')}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(row.last_active_at), { addSuffix: true })}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <UsageUsersPagination
                    page={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredUsers.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
