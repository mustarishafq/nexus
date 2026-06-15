import React from 'react';
import { Link } from 'react-router-dom';
import UserAvatar from '@/components/users/UserAvatar';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';

const CARD_WIDTH = 200;

function PersonCard({ user, hasReports }) {
  const subtitle = [user.job_title, user.department].filter(Boolean).join(' · ');

  return (
    <Link
      to={`/people/${user.id}`}
      className={cn(
        'group flex w-[200px] flex-col items-center rounded-xl border border-border/80 bg-card px-4 py-3.5 text-center shadow-sm transition-colors',
        'hover:border-primary/35 hover:shadow-md'
      )}
    >
      <UserAvatar user={user} className="h-12 w-12" />
      <p className="mt-2.5 text-sm font-semibold leading-snug group-hover:text-primary">
        {getDisplayName(user)}
      </p>
      {subtitle ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground/70">No title set</p>
      )}
      {hasReports ? (
        <span className="mt-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Manager
        </span>
      ) : null}
    </Link>
  );
}

function OrgChartNode({ branch }) {
  const user = branch?.user;
  if (!user) return null;

  const reports = Array.isArray(branch.reports) ? branch.reports : [];

  return (
    <div className="inline-flex flex-col items-center">
      <PersonCard user={user} hasReports={reports.length > 0} />

      {reports.length > 0 ? (
        <div className="flex flex-col items-center">
          <div className="h-8 w-px bg-border" aria-hidden />

          {reports.length === 1 ? (
            <OrgChartNode branch={reports[0]} />
          ) : (
            <ul
              className="relative m-0 flex list-none items-start justify-center gap-6 p-0"
              style={{ paddingTop: '2rem' }}
            >
              <div
                className="pointer-events-none absolute top-0 left-1/2 h-px -translate-x-1/2 bg-border"
                style={{ width: `calc(100% - ${CARD_WIDTH}px)` }}
                aria-hidden
              />
              {reports.map((child) => (
                <li key={child.user.id} className="relative flex flex-col items-center">
                  <div
                    className="absolute top-0 left-1/2 h-8 w-px -translate-x-1/2 bg-border"
                    aria-hidden
                  />
                  <OrgChartNode branch={child} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function OrgChartTree({ tree }) {
  const branches = Array.isArray(tree) ? tree : [];

  if (branches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No reporting structure yet. Assign managers in User Management to build the org chart.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-6">
      <div className="mx-auto flex min-w-max items-start justify-center gap-10">
        {branches.map((branch) => (
          <OrgChartNode key={branch.user.id} branch={branch} />
        ))}
      </div>
    </div>
  );
}
