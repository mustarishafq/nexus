import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartTooltipBox,
  chartAxisTick,
  chartGridStroke,
  chartTooltipProps,
} from '@/lib/chartTooltip';

const CHART_1 = 'hsl(var(--chart-1))';
const CHART_2 = 'hsl(var(--chart-2))';

function formatDayLabel(value) {
  try {
    return format(typeof value === 'string' ? parseISO(value) : new Date(value), 'MMM d');
  } catch {
    return value;
  }
}

function DailyActiveUsersChart({ data, periodDays, scopeLabel }) {
  const chartData = useMemo(
    () =>
      (data ?? []).map((point) => ({
        ...point,
        label: formatDayLabel(point.date),
      })),
    [data]
  );

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <LineChartIcon className="w-4 h-4 text-primary" />
          Daily activity ({periodDays} days)
        </CardTitle>
        <p className="text-xs text-muted-foreground">{scopeLabel}</p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
            No launch activity in this period yet.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="activeUsersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_1} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_1} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDayLabel}
                  tick={{ ...chartAxisTick, fontSize: 10 }}
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="users"
                  tick={{ ...chartAxisTick, fontSize: 10 }}
                  allowDecimals={false}
                  width={32}
                />
                <YAxis
                  yAxisId="launches"
                  orientation="right"
                  tick={{ ...chartAxisTick, fontSize: 10 }}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  {...chartTooltipProps}
                  content={
                    <ChartTooltipBox
                      labelFormatter={formatDayLabel}
                      formatter={(value, name) => {
                        if (name === 'active_users') return [value, 'Active users'];
                        if (name === 'launches') return [value, 'Launches'];
                        return [value, name];
                      }}
                    />
                  }
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  wrapperStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  formatter={(value) => (value === 'active_users' ? 'Active users' : 'Launches')}
                />
                <Area
                  yAxisId="users"
                  type="monotone"
                  dataKey="active_users"
                  name="active_users"
                  stroke={CHART_1}
                  fill="url(#activeUsersFill)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  yAxisId="launches"
                  type="monotone"
                  dataKey="launches"
                  name="launches"
                  stroke={CHART_2}
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationBreakdownChart({ data, period, periodDays }) {
  const valueKey = period === 'wau' ? 'wau' : 'mau';
  const chartData = useMemo(
    () =>
      (data ?? []).map((app) => ({
        name: app.name,
        active_users: app[valueKey] ?? 0,
      })),
    [data, valueKey]
  );

  if (!chartData.length) {
    return null;
  }

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          By application ({periodDays} days)
        </CardTitle>
        <p className="text-xs text-muted-foreground">Active users per app in your scope</p>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={28} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ ...chartAxisTick, fontSize: 10 }}
                interval={0}
                angle={chartData.length > 4 ? -24 : 0}
                textAnchor={chartData.length > 4 ? 'end' : 'middle'}
                height={chartData.length > 4 ? 52 : 28}
              />
              <YAxis
                tick={{ ...chartAxisTick, fontSize: 10 }}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                {...chartTooltipProps}
                content={<ChartTooltipBox formatter={(value) => [value, 'Active users']} />}
              />
              <Bar
                dataKey="active_users"
                name="Active users"
                fill={CHART_1}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApplicationUsageCharts({
  trendDaily = [],
  byApplication = [],
  period,
  periodDays,
  scopeLabel,
  isOverall,
}) {
  const slicedTrend = useMemo(() => {
    if (period === 'wau') {
      return trendDaily.slice(-7);
    }
    return trendDaily;
  }, [trendDaily, period]);

  return (
    <div className={isOverall && byApplication.length > 1 ? 'grid grid-cols-1 xl:grid-cols-2 gap-4' : ''}>
      <DailyActiveUsersChart
        data={slicedTrend}
        periodDays={periodDays}
        scopeLabel={scopeLabel}
      />
      {isOverall && byApplication.length > 1 ? (
        <ApplicationBreakdownChart
          data={byApplication}
          period={period}
          periodDays={periodDays}
        />
      ) : null}
    </div>
  );
}
