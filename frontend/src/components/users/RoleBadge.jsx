import React from 'react';
import { cva } from 'class-variance-authority';
import { ShieldCheck, UserRound, Users } from 'lucide-react';
import { getRoleLabel, resolveRole, ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';

const roleBadgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold tracking-tight transition-colors',
  {
    variants: {
      role: {
        admin:
          'border-primary/35 bg-gradient-to-r from-primary via-primary to-info text-primary-foreground shadow-md shadow-primary/30 ring-1 ring-primary/25',
        hr: 'border-amber-500/40 bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-orange-400/10 text-amber-950 shadow-sm shadow-amber-500/15 dark:border-amber-400/35 dark:from-amber-500/30 dark:via-amber-400/20 dark:to-orange-400/15 dark:text-amber-50',
        user: 'border-border/90 bg-gradient-to-r from-muted/90 to-muted/50 text-foreground/75 shadow-sm dark:from-muted/70 dark:to-muted/40 dark:text-foreground/80',
      },
      size: {
        sm: 'h-5 px-2 text-[10px] [&_svg]:h-3 [&_svg]:w-3',
        md: 'h-6 px-2.5 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5',
      },
    },
    defaultVariants: {
      role: 'user',
      size: 'md',
    },
  }
);

const ROLE_ICONS = {
  [ROLES.ADMIN]: ShieldCheck,
  [ROLES.HR]: Users,
  [ROLES.USER]: UserRound,
};

export default function RoleBadge({ role, className, size = 'md', showIcon = true }) {
  const resolvedRole = resolveRole(role);
  const Icon = ROLE_ICONS[resolvedRole];

  return (
    <span className={cn(roleBadgeVariants({ role: resolvedRole, size }), className)}>
      {showIcon ? <Icon className="shrink-0" aria-hidden /> : null}
      {getRoleLabel(role)}
    </span>
  );
}
