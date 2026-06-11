// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Monitor, Users, Search, TrendingUp, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import ApplicationsNav from '@/components/applications/ApplicationsNav';
import StatsCard from '@/components/dashboard/StatsCard';
import UserAvatar from '@/components/users/UserAvatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

export default function ApplicationUsage() {
  const { user } = useAuth();
  const [selectedAppId, setSelectedAppId] = useState('overall');
  const [period, setPeriod] = useState('wau');
  const [userView, setUserView] = useState('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

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

  const { data: usageDetail, isLoading: loadingUsage } = useQuery({
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

  const filteredUsers = useMemo(
    () => filterUsersBySearch(displayedUsers, search),
    [displayedUsers, search]
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(
    () => filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredUsers, currentPage]
  );

  useEffect(() => {
    setPage(1);
  }, [search, period, userView, selectedAppId]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useMetaTags({
    title: 'Active Users - Applications - EMZI Nexus Brain',
    description: 'Monitor WAU and MAU with per-user launch activity',
  });

  if (!showUsage) {
    return <Navigate to="/applications" replace />;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
              Application
            </h1>
            <ApplicationsNav showUsage />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Track active and inactive users with access, based on app launches in Nexus
        </p>
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
          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1 w-full sm:w-fit">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setPeriod(tab.value)}
                className={cn(
                  'flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  period === tab.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1 w-full sm:w-fit">
            {USER_VIEW_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setUserView(tab.value)}
                className={cn(
                  'flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  userView === tab.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
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
            <StatsCard
              title={period === 'wau' ? 'Weekly Active' : 'Monthly Active'}
              value={activeCount}
              subtitle={`Launched in the last ${period === 'wau' ? '7' : '30'} days`}
              icon={Users}
              color="bg-primary/10"
              index={1}
            />
            <StatsCard
              title={period === 'wau' ? 'Weekly Inactive' : 'Monthly Inactive'}
              value={inactiveCount}
              subtitle="Have access but did not launch"
              icon={UserX}
              color="bg-warning/10"
              index={2}
            />
            <StatsCard
              title="Weekly Stickiness"
              value={mauCount > 0 ? `${stickiness}%` : '—'}
              subtitle="WAU divided by MAU"
              icon={TrendingUp}
              color="bg-success/10"
              index={3}
            />
          </div>

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
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-0 pb-0">
              {filteredUsers.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground px-6">
                  {search
                    ? 'No users match your search.'
                    : userView === 'active'
                      ? `No ${period === 'wau' ? 'weekly' : 'monthly'} active users yet.`
                      : `No ${period === 'wau' ? 'weekly' : 'monthly'} inactive users — everyone with access has launched.`}
                </div>
              ) : userView === 'active' ? (
                <>
                <div className="rounded-xl border border-border overflow-hidden mx-6 mb-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        {isOverall && <TableHead className="hidden lg:table-cell">Apps used</TableHead>}
                        <TableHead>Launches</TableHead>
                        <TableHead className="hidden sm:table-cell">First active</TableHead>
                        <TableHead>Last active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((row) => {
                        const lastActive = new Date(row.last_active_at);
                        const firstActive = new Date(row.first_active_at);

                        return (
                          <TableRow key={row.user_id}>
                            <TableCell>
                              <div className="flex items-center gap-3 min-w-0">
                                <UserAvatar user={row} className="h-9 w-9" fallbackClassName="text-xs" />
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {row.full_name || row.email || row.user_id}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate md:hidden">
                                    {row.email || '—'}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {row.email || '—'}
                            </TableCell>
                            {isOverall && (
                              <TableCell className="hidden lg:table-cell">
                                <Badge variant="outline" className="tabular-nums">
                                  {row.apps_used ?? 1}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge variant="secondary" className="tabular-nums">
                                {row.launch_count}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                              {format(firstActive, 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              <div>{format(lastActive, 'MMM d, yyyy · h:mm a')}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(lastActive, { addSuffix: true })}
                              </div>
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
              ) : (
                <>
                <div className="rounded-xl border border-border overflow-hidden mx-6 mb-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">Total launches</TableHead>
                        <TableHead>Last launch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((row) => (
                        <TableRow key={row.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar user={row} className="h-9 w-9" fallbackClassName="text-xs" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {row.full_name || row.email || row.user_id}
                                </p>
                                <p className="text-xs text-muted-foreground truncate md:hidden">
                                  {row.email || '—'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
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
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="secondary" className="tabular-nums">
                              {row.total_launch_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
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
                      ))}
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
