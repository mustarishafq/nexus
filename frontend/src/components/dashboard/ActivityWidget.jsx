import React from 'react';
import { Activity, ArrowRight, LogIn, LogOut, Plus, Pencil, Trash2, CheckCircle, XCircle, Eye, Download, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const actionIcons = {
  login: LogIn, logout: LogOut, create: Plus, update: Pencil,
  delete: Trash2, approve: CheckCircle, reject: XCircle,
  view: Eye, export: Download, import: Upload, other: Activity,
};

const actionColors = {
  login: 'text-info bg-info/10', logout: 'text-muted-foreground bg-muted',
  create: 'text-success bg-success/10', update: 'text-primary bg-primary/10',
  delete: 'text-destructive bg-destructive/10', approve: 'text-success bg-success/10',
  reject: 'text-destructive bg-destructive/10', view: 'text-info bg-info/10',
  export: 'text-warning bg-warning/10', import: 'text-warning bg-warning/10',
  other: 'text-muted-foreground bg-muted',
};

export default function ActivityWidget({ activities }) {
  const recent = activities.slice(0, 8);

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Recent Activity</h3>
        </div>
        <Link to="/activity">
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="px-5 pb-4">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-3 bottom-3 w-px bg-border" />
            <div className="space-y-3">
              {recent.map(log => {
                const Icon = actionIcons[log.action] || Activity;
                const colors = actionColors[log.action] || actionColors.other;
                return (
                  <div key={log.id} className="flex items-start gap-3 relative">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10", colors)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm leading-snug">
                        <span className="font-medium">{log.user_name || log.user_id || 'System'}</span>
                        {' '}<span className="text-muted-foreground">{log.description}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {log.system_id && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {log.system_id}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}