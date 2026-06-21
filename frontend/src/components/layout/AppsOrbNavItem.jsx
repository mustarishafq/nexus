import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AppsOrbNavItem({ isActive, to = '/applications', label = 'Apps' }) {
  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className="relative flex flex-1 flex-col items-center justify-end gap-2 pb-1"
    >
      <span
        className={cn(
          'apps-orb-nav relative -mt-6 flex h-[3rem] w-[3rem] items-center justify-center pointer-events-none',
          isActive && 'apps-orb-nav--active'
        )}
      >
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
          'mt-0.5 text-[10px] font-semibold leading-none',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </Link>
  );
}
