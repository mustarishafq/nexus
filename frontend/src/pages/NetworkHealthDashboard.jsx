// @ts-nocheck
import db from '@/api/base44Client';
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, Download, Gauge, Timer, Upload, Users, Wifi,
  CheckCircle, Filter, FileDown,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StatsCard from '@/components/dashboard/StatsCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ALERT_LABELS = {
  latency: 'High Latency',
  download: 'Low Download',
  upload: 'Low Upload',
};

function formatHourLabel(value) {
  if (!value) return '';
  return format(new Date(value), 'MMM d, ha');
}

export default function NetworkHealthDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [userId, setUserId] = useState('');
  const [accessGroupId, setAccessGroupId] = useState('');
  const [browser, setBrowser] = useState('');
  const [operatingSystem, setOperatingSystem] = useState('');

  const filters = useMemo(() => ({
    date_from: dateFrom,
    date_to: dateTo,
    ...(userId ? { user_id: userId } : {}),
    ...(accessGroupId ? { access_group_id: accessGroupId } : {}),
    ...(browser ? { browser } : {}),
    ...(operatingSystem ? { operating_system: operatingSystem } : {}),
  }), [dateFrom, dateTo, userId, accessGroupId, browser, operatingSystem]);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['network-health-dashboard', filters],
    queryFn: () => db.networkHealth.dashboard(filters),
    enabled: user?.role === 'admin',
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-network-health'],
    queryFn: () => db.entities.User.list('-created_date', 500),
    enabled: user?.role === 'admin',
  });

  const { data: accessGroups = [] } = useQuery({
    queryKey: ['access-groups-network-health'],
    queryFn: () => db.entities.AccessGroup.list('name', 200),
    enabled: user?.role === 'admin',
  });

  const { data: userHistory } = useQuery({
    queryKey: ['network-health-user-history', userId],
    queryFn: () => db.networkHealth.userHistory(userId),
    enabled: user?.role === 'admin' && Boolean(userId),
  });

  const acknowledgeMut = useMutation({
    mutationFn: (alertId) => db.networkHealth.acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-health-dashboard'] });
      toast.success('Alert acknowledged');
    },
    onError: () => toast.error('Failed to acknowledge alert'),
  });

  const handleExport = async () => {
    try {
      await db.networkHealth.exportCsv(filters);
      toast.success('Export started');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
        Admin access required.
      </div>
    );
  }

  const summary = dashboard?.summary || {};
  const hourlyTrends = dashboard?.hourly_trends || [];
  const latestResults = dashboard?.latest_results || [];
  const slowestUsers = dashboard?.slowest_users || [];
  const lowestDownloadUsers = dashboard?.lowest_download_users || [];
  const activeAlerts = dashboard?.active_alerts || [];
  const averages = dashboard?.averages || {};

  const browserOptions = [...new Set(latestResults.map((r) => r.browser).filter(Boolean))];
  const osOptions = [...new Set(latestResults.map((r) => r.operating_system).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wifi className="w-6 h-6 text-primary" />
            Network Health Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            System Monitoring — client network performance across Nexus Brain users
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <FileDown className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">User</label>
              <Select value={userId || 'all'} onValueChange={(v) => setUserId(v === 'all' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="All users" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Department</label>
              <Select value={accessGroupId || 'all'} onValueChange={(v) => setAccessGroupId(v === 'all' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {accessGroups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Browser</label>
              <Select value={browser || 'all'} onValueChange={(v) => setBrowser(v === 'all' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="All browsers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All browsers</SelectItem>
                  {browserOptions.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Operating System</label>
              <Select value={operatingSystem || 'all'} onValueChange={(v) => setOperatingSystem(v === 'all' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="All OS" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All OS</SelectItem>
                  {osOptions.map((os) => (
                    <SelectItem key={os} value={os}>{os}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Avg Latency"
          value={isLoading ? '—' : summary.avg_latency_ms != null ? `${summary.avg_latency_ms} ms` : 'N/A'}
          icon={Timer}
          color="bg-orange-500/10"
          index={0}
        />
        <StatsCard
          title="Avg Download"
          value={isLoading ? '—' : summary.avg_download_mbps != null ? `${summary.avg_download_mbps} Mbps` : 'N/A'}
          icon={Download}
          color="bg-blue-500/10"
          index={1}
        />
        <StatsCard
          title="Avg Upload"
          value={isLoading ? '—' : summary.avg_upload_mbps != null ? `${summary.avg_upload_mbps} Mbps` : 'N/A'}
          icon={Upload}
          color="bg-green-500/10"
          index={2}
        />
        <StatsCard
          title="Users Tested Today"
          value={isLoading ? '—' : summary.users_tested_today ?? 0}
          icon={Users}
          color="bg-primary/10"
          index={3}
        />
      </div>

      {/* Period Averages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Daily Averages', data: averages.daily },
          { label: 'Weekly Averages', data: averages.weekly },
          { label: 'Monthly Averages', data: averages.monthly },
        ].map(({ label, data }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Latency: <span className="font-medium">{data?.avg_latency_ms ?? 'N/A'} ms</span></p>
              <p>Download: <span className="font-medium">{data?.avg_download_mbps ?? 'N/A'} Mbps</span></p>
              <p>Upload: <span className="font-medium">{data?.avg_upload_mbps ?? 'N/A'} Mbps</span></p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-warning">
              <AlertTriangle className="w-4 h-4" />
              Active Alerts ({activeAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border bg-muted/30"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-warning border-warning/30">
                        {ALERT_LABELS[alert.alert_type] || alert.alert_type}
                      </Badge>
                      <span className="text-sm font-medium">
                        {alert.user?.full_name || alert.user?.email}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Value: {alert.metric_value} (threshold: {alert.threshold_value})
                      {' · '}
                      {alert.created_date ? format(new Date(alert.created_date), 'MMM d, h:mm a') : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => acknowledgeMut.mutate(alert.id)}
                    disabled={acknowledgeMut.isPending}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: 'Latency Trend (hourly)', dataKey: 'avg_latency_ms', color: 'hsl(25 95% 53%)', unit: 'ms' },
          { title: 'Download Speed Trend (hourly)', dataKey: 'avg_download_mbps', color: 'hsl(210 100% 52%)', unit: 'Mbps' },
          { title: 'Upload Speed Trend (hourly)', dataKey: 'avg_upload_mbps', color: 'hsl(160 84% 39%)', unit: 'Mbps' },
        ].map((chart) => (
          <Card key={chart.dataKey}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                {chart.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hourlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="hour_bucket"
                      tickFormatter={formatHourLabel}
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      labelFormatter={formatHourLabel}
                      formatter={(value) => [`${Number(value).toFixed(2)} ${chart.unit}`, chart.title]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={chart.dataKey}
                      stroke={chart.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {userId && userHistory?.history?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Per-User History — {userHistory.user?.full_name || userHistory.user?.email}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Latency</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Tested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userHistory.history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.latency_ms != null ? `${row.latency_ms} ms` : '—'}</TableCell>
                    <TableCell>{row.download_mbps != null ? `${row.download_mbps} Mbps` : '—'}</TableCell>
                    <TableCell>{row.upload_mbps != null ? `${row.upload_mbps} Mbps` : '—'}</TableCell>
                    <TableCell>{row.browser || '—'}</TableCell>
                    <TableCell>{row.operating_system || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.tested_at ? format(new Date(row.tested_at), 'MMM d, h:mm a') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Latest Test Results</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Down</TableHead>
                  <TableHead>Up</TableHead>
                  <TableHead>Tested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No results yet</TableCell>
                  </TableRow>
                ) : latestResults.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.user?.full_name || row.user?.email}</TableCell>
                    <TableCell>{row.latency_ms != null ? `${row.latency_ms} ms` : '—'}</TableCell>
                    <TableCell>{row.download_mbps != null ? `${row.download_mbps}` : '—'}</TableCell>
                    <TableCell>{row.upload_mbps != null ? `${row.upload_mbps}` : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.tested_at ? format(new Date(row.tested_at), 'MMM d, h:mm a') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Slowest Users (avg latency)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Avg Latency</TableHead>
                  <TableHead>Last Test</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slowestUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No data</TableCell>
                  </TableRow>
                ) : slowestUsers.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-medium">{row.user?.full_name || row.user?.email}</TableCell>
                    <TableCell className={cn(row.avg_latency_ms > 300 && 'text-warning font-medium')}>
                      {row.avg_latency_ms} ms
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.last_tested_at ? format(new Date(row.last_tested_at), 'MMM d, h:mm a') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lowest Download Speed Users</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Avg Download</TableHead>
                  <TableHead>Last Test</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowestDownloadUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No data</TableCell>
                  </TableRow>
                ) : lowestDownloadUsers.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-medium">{row.user?.full_name || row.user?.email}</TableCell>
                    <TableCell className={cn(row.avg_download_mbps < 5 && 'text-warning font-medium')}>
                      {row.avg_download_mbps} Mbps
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.last_tested_at ? format(new Date(row.last_tested_at), 'MMM d, h:mm a') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
