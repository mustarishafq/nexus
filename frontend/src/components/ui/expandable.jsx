import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const EXPAND_EASE = [0.16, 1, 0.3, 1];
export const EXPAND_DURATION = 0.32;

/**
 * Smooth height + opacity expand/collapse wrapper.
 * Use for show-more panels, disclosure sections, and filter drawers.
 */
export function Expandable({
  open,
  children,
  className,
  contentClassName,
  duration = EXPAND_DURATION,
  ease = EXPAND_EASE,
}) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="expandable-content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration, ease }}
          className={cn('overflow-hidden', className)}
        >
          <div className={contentClassName}>{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
