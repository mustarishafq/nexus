import db from '@/api/base44Client';
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRecentApplications, launchApplication } from '@/lib/applications';
import { toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

function ApplicationLaunchTile({ app, launching, onLaunch }) {
  const isLaunching = launching === app.id;

  return (
    <button
      type="button"
      onClick={() => onLaunch(app)}
      disabled={!app.is_enabled || isLaunching}
      className={cn(
        'group relative flex flex-col items-center rounded-xl border border-border/70 bg-muted/20 p-3 text-center transition-all',
        app.is_enabled
          ? 'cursor-pointer hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm'
          : 'cursor-not-allowed opacity-60'
      )}
    >
      <div className="relative mb-2.5">
        {app.icon_url ? (
          <img
            src={toAbsoluteUrl(app.icon_url)}
            alt={app.name}
            className="h-12 w-12 rounded-xl object-cover shadow-sm transition-shadow group-hover:shadow-md"
          />
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm transition-shadow group-hover:shadow-md"
            style={{ backgroundColor: app.color || '#6366f1' }}
          >
            {app.name?.[0]?.toUpperCase()}
          </div>
        )}
        {isLaunching ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        ) : null}
      </div>
      <p className="line-clamp-2 w-full text-xs font-semibold leading-tight">{app.name}</p>
      {app.lastUsed ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(app.lastUsed), { addSuffix: true })}
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-muted-foreground">Tap to open</p>
      )}
    </button>
  );
}

export default function ProfileRecentApplicationsWidget({
  applications = [],
  activities = [],
}) {
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(null);
  const recentApplications = useMemo(
    () => getRecentApplications(applications, activities, 6),
    [applications, activities]
  );

  const handleLaunch = async (app) => {
    if (!app.is_enabled || launching === app.id) return;

    setLaunching(app.id);

    try {
      await launchApplication(db, app, navigate);
    } catch (err) {
      alert(err.message || 'Unable to launch application.');
    } finally {
      setLaunching(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Recent Applications</h3>
        </div>
        {applications.length > 0 ? (
          <Link to="/applications">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        ) : null}
      </div>
      {recentApplications.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 px-5">
          No applications available yet. Ask an admin to grant access.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-5 pb-5">
          {recentApplications.map((app) => (
            <ApplicationLaunchTile
              key={app.id}
              app={app}
              launching={launching}
              onLaunch={handleLaunch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
