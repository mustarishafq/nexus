import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipBox, chartAxisTick, chartGridStroke } from '@/lib/chartTooltip';

const SERIES_COLORS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'];

function seriesColor(index) {
  const token = SERIES_COLORS[index % SERIES_COLORS.length];
  return `hsl(var(${token}))`;
}

function chartPoints(chart) {
  return Array.isArray(chart?.points) ? chart.points : [];
}

function chartSeries(chart) {
  const series = Array.isArray(chart?.series) ? chart.series : [];
  return series.filter((item) => item && item.key);
}

function ChartFrame({ title, children }) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border/70 bg-background/80 p-2.5">
      {title ? <p className="mb-2 text-xs font-semibold text-foreground">{title}</p> : null}
      <div className="h-56 w-full min-w-0">{children}</div>
    </div>
  );
}

function ChartTooltip(props) {
  return <ChartTooltipBox {...props} />;
}

function categoryAxes(series) {
  return [
    <CartesianGrid key="grid" strokeDasharray="3 3" stroke={chartGridStroke} />,
    <XAxis key="x" dataKey="label" tick={{ ...chartAxisTick, fontSize: 11 }} interval="preserveStartEnd" />,
    <YAxis key="y" tick={{ ...chartAxisTick, fontSize: 11 }} width={40} />,
    <Tooltip key="tooltip" content={<ChartTooltip />} />,
    series.length > 1 ? <Legend key="legend" wrapperStyle={{ fontSize: 11 }} /> : null,
  ];
}

function CategoryChart({ chart }) {
  const points = chartPoints(chart);
  const series = chartSeries(chart);

  if (chart.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {categoryAxes(series)}
          {series.map((item, index) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label || item.key}
              stroke={seriesColor(index)}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {categoryAxes(series)}
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label || item.key}
            fill={seriesColor(index)}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieVisual({ chart }) {
  const points = chartPoints(chart);
  const series = chartSeries(chart);
  const dataKey = series[0]?.key || 's0';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={points} dataKey={dataKey} nameKey="label" cx="50%" cy="50%" outerRadius={78}>
          {points.map((point, index) => (
            <Cell key={`${point.label}-${index}`} fill={seriesColor(index)} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function ChatVisuals({ visuals }) {
  if (!Array.isArray(visuals) || visuals.length === 0) return null;

  return (
    <div>
      {visuals.map((chart, index) => {
        const title = String(chart?.title || '');
        const body = chart?.type === 'pie' ? <PieVisual chart={chart} /> : <CategoryChart chart={chart} />;
        return (
          <ChartFrame key={`${title}-${index}`} title={title}>
            {body}
          </ChartFrame>
        );
      })}
    </div>
  );
}
