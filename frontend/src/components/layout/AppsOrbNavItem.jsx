import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { glassDockNavItemInactive, glassDockNavLabel } from './glassStyles';

export default function AppsOrbNavItem({ isActive, to = '/applications', label = 'Apps' }) {
  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className="relative flex flex-1 flex-col items-center justify-end gap-1 pb-0.5"
    >
      <span
        className={cn(
          'apps-orb-nav pointer-events-none relative -mt-6 flex size-12 shrink-0 grow-0 items-center justify-center overflow-visible',
          isActive && 'apps-orb-nav--active'
        )}
      >
        <span aria-hidden className="apps-orb-nav__glass" />
        <span aria-hidden className="apps-orb-nav__pulse" />
        <span aria-hidden className="apps-orb-nav__pulse apps-orb-nav__pulse--delayed" />

        <span aria-hidden className="apps-orb-nav__nerve">
          <span className="apps-orb-nav__nerve-track" />
          <span className="apps-orb-nav__nerve-impulse" />
          {[0, 72, 144, 216, 288].map((angle) => (
            <span
              key={angle}
              className="apps-orb-nav__nerve-node"
              style={{
                '--nerve-angle': `${angle}deg`,
                '--nerve-delay': `${-(angle / 360) * 8}s`,
              }}
            />
          ))}
        </span>

        <span className="apps-orb-nav__core">
          <span className="apps-orb-nav__icon apps-orb-nav__icon--monitor" aria-hidden>
            <Monitor className="h-6 w-6 text-primary-foreground" strokeWidth={2.25} />
          </span>
          <span className="apps-orb-nav__icon apps-orb-nav__icon--brain" aria-hidden>
            <Brain className="h-6 w-6 text-primary-foreground" strokeWidth={2.25} />
          </span>
        </span>
      </span>

      <span
        className={cn(
          glassDockNavLabel,
          isActive ? 'text-primary font-semibold' : glassDockNavItemInactive
        )}
      >
        {label}
      </span>
    </Link>
  );
}
