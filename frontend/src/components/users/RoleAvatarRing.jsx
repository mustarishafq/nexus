import React from 'react';
import { cva } from 'class-variance-authority';
import { resolveRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

const roleAvatarRingClass = cva('ring-offset-0 ring-offset-background', {
  variants: {
    role: {
      admin: 'ring-[4px] ring-primary',
      hr: 'ring-[3px] ring-amber-500',
      user: 'ring-[3px] ring-slate-300/90 dark:ring-slate-500/85',
    },
    immersive: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    {
      role: 'admin',
      immersive: true,
      className: 'shadow-[0_0_22px_-6px_hsl(var(--primary)/0.6)]',
    },
    {
      role: 'hr',
      immersive: true,
      className: 'shadow-[0_0_18px_-8px_rgba(245,158,11,0.5)]',
    },
    {
      role: 'user',
      immersive: true,
      className: 'shadow-[0_4px_12px_-10px_hsl(var(--foreground)/0.12)]',
    },
  ],
  defaultVariants: {
    role: 'user',
    immersive: false,
  },
});

export function getRoleAvatarRingClassName(role, { immersive = false, className } = {}) {
  return cn(roleAvatarRingClass({ role: resolveRole(role), immersive }), className);
}

export default function RoleAvatarRing({ role, className, immersive = false, children }) {
  if (!React.isValidElement(children)) {
    return children;
  }

  return React.cloneElement(children, {
    className: cn(
      children.props.className,
      getRoleAvatarRingClassName(role, { immersive, className })
    ),
  });
}
