import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';

export default function NotificationChart({ notifications }) {
  // Group by type
  const typeCounts = { info: 0, success: 0, warning: 0, error: 0, critical: 0 };
  notifications.forEach(n => {
    if (typeCounts[n.type] !== undefined) typeCounts[n.type]++;
  });

  const data = [
    { name: 'Info', count: typeCounts.info, fill: 'hsl(210 100% 52%)' },
    { name: 'Success', count: typeCounts.success, fill: 'hsl(160 84% 39%)' },
    { name: 'Warning', count: typeCounts.warning, fill: 'hsl(38 92% 50%)' },
    { name: 'Error', count: typeCounts.error, fill: 'hsl(0 84% 60%)' },
    { name: 'Critical', count: typeCounts.critical, fill: 'hsl(330 80% 55%)' },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Notification Distribution</h3>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}