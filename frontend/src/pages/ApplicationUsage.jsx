// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Monitor, Users, Search, TrendingUp, UserX } from 'lucide-react';
import ApplicationsNav from '@/components/applications/ApplicationsNav';
import StatsCard from '@/components/dashboard/StatsCard';
import UserAvatar from '@/components/users/UserAvatar';
import { Input } from '@/components/ui/input';
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

export default function ApplicationUsage() {
  const { user } = useAuth();
  const [selectedAppId, setSelectedAppId] = useState('');
  const [period, setPeriod] = useState('wau');
  const [userView, setUserView] = useState('active');
  const [search, setSearch] = useState('');

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
      setSelectedAppId('');
      return;
    }

    const stillValid = manageableApps.some(
      (app) => String(app.id) === String(selectedAppId)
    );

    if (!stillValid) {
      setSelectedAppId(String(manageableApps[0].id));
    }
  }, [manageableApps, selectedAppId]);

  const { data: usageDetail, isLoading: loadingUsage } = useQuery({
    queryKey: ['application-usage-detail', selectedAppId],
    queryFn: () => db.getApplicationUsageStats(selectedAppId),
    enabled: showUsage && Boolean(selectedAppId),
    staleTime: 60_000,
  });

  const selectedApp = manageableApps.find(
    (app) => String(app.id) === String(selectedAppId)
  );

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
            <SelectValue placeholder="Select application" />
          </SelectTrigger>
          <SelectContent>
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
              subtitle="Users with access to this app"
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
                  {selectedApp?.name || 'Application'} · {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
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
            <CardContent className="pt-0">
              {filteredUsers.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  {search
                    ? 'No users match your search.'
                    : userView === 'active'
                      ? `No ${period === 'wau' ? 'weekly' : 'monthly'} active users yet.`
                      : `No ${period === 'wau' ? 'weekly' : 'monthly'} inactive users — everyone with access has launched.`}
                </div>
              ) : userView === 'active' ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Launches</TableHead>
                        <TableHead className="hidden sm:table-cell">First active</TableHead>
                        <TableHead>Last active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((row) => {
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
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
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
                      {filteredUsers.map((row) => (
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
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
