import db from '@/api/base44Client';
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ApplicationCard from '@/components/applications/ApplicationCard';
import { getRecentApplications, launchApplication } from '@/lib/applications';

function getFooterSubtitle(app, readOnly) {
  if (app.lastUsed) {
    return formatDistanceToNow(new Date(app.lastUsed), { addSuffix: true });
  }

  return readOnly ? 'Recently used' : 'Tap to open';
}

export default function ProfileRecentApplicationsWidget({
  applications = [],
  activities = [],
  readOnly = false,
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
        {applications.length > 0 && !readOnly ? (
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
        <div className="grid grid-cols-3 gap-3 px-5 pb-5 sm:grid-cols-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {recentApplications.map((app, index) => (
            <div
              key={app.id}
              className="rounded-xl border border-border bg-card p-2 shadow-sm transition-shadow hover:shadow-md sm:p-2.5"
            >
              <ApplicationCard
                system={app}
                index={index}
                canManageSystem={false}
                launching={launching}
                onLaunch={readOnly ? undefined : handleLaunch}
                footerSubtitle={getFooterSubtitle(app, readOnly)}
                readOnly={readOnly}
                footerOutside
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
