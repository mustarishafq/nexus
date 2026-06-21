import React from 'react';
import { cn } from '@/lib/utils';
import { glassDockStyles, glassPanelStyles } from '@/components/layout/glassStyles';

const MOCK_APPS = [
  { name: 'EMZI Nexus', color: '#2563eb' },
  { name: 'EMZI.Sale', color: '#16a34a' },
  { name: 'Booking', color: '#7c3aed' },
  { name: 'Phantom', color: '#0ea5e9' },
  { name: 'Analytics', color: '#f59e0b' },
  { name: 'Calendar', color: '#ec4899' },
  { name: 'Messages', color: '#6366f1' },
  { name: 'Studio', color: '#14b8a6' },
];

export default function LaunchMockAppGrid({ className }) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-[#0b1220]', className)} aria-hidden>
      <div className={cn('border-b px-4 py-3', glassPanelStyles)}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Applications</p>
        <p className="mt-0.5 text-sm font-medium text-white/80">Your apps</p>
      </div>
      <div className="grid grid-cols-3 gap-2.5 p-3 sm:grid-cols-4">
        {MOCK_APPS.map((app) => (
          <div key={app.name} className="rounded-xl border border-white/10 bg-white/5 p-2 shadow-sm">
            <div
              className="mb-2 aspect-square w-full rounded-lg"
              style={{ backgroundColor: app.color }}
            />
            <p className="line-clamp-2 text-center text-[9px] font-medium leading-tight text-white/75">
              {app.name}
            </p>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 px-3 pb-2">
        <div className={cn('flex justify-around px-4 py-2', glassDockStyles)}>
          <div className="flex w-full justify-around text-[8px] text-muted-foreground">
            <span>Dashboard</span>
            <span>People</span>
            <span className="font-semibold text-primary">Apps</span>
            <span>Settings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
