import React, { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ExternalLink, ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import db from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  filterActionItems,
  formatTodoTitle,
  getTodoActionHint,
  getTodoCategoryLabel,
} from '@/lib/actionItems';
import { followNotificationAction } from '@/lib/notificationAction';
import {
  invalidateActionItemsCache,
  useActionItems,
} from '@/hooks/useActionItems';
import { invalidateNotificationQueries } from '@/hooks/useNotifications';

const DISPLAY_LIMIT = 6;
const CHECK_HOLD_MS = 240;
const EXIT_DURATION = 0.38;

export default function ActionItemsWidget() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: todos = [], isLoading } = useActionItems();
  const actionItems = filterActionItems(todos).slice(0, DISPLAY_LIMIT);
  const pendingCount = filterActionItems(todos).length;
  const hiddenCount = Math.max(0, pendingCount - DISPLAY_LIMIT);

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list('sort_order', 50),
    staleTime: 60_000,
  });

  const invalidateCaches = useCallback(() => {
    invalidateActionItemsCache(queryClient);
    invalidateNotificationQueries(queryClient);
  }, [queryClient]);

  const completeItem = useCallback(async (todo) => {
    await db.dashboard.completeActionItem(todo.id);
    invalidateCaches();
  }, [invalidateCaches]);

  const handleOpen = useCallback(async (todo) => {
    try {
      const hasTarget = Boolean(
        todo.action_url?.trim() || todo.system_id?.trim()
      );

      if (hasTarget) {
        await followNotificationAction(todo, { applications, navigate });
        return;
      }

      navigate('/notifications');
    } catch (error) {
      toast.error(error?.message || 'Unable to open this task.');
    }
  }, [applications, navigate]);

  const handleMarkDone = useCallback(async (todo) => {
    await completeItem(todo);
  }, [completeItem]);

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-sm">To-do</h3>
            {pendingCount > 0 ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                {pendingCount}
              </Badge>
            ) : null}
          </div>
          {pendingCount > 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {pendingCount} task{pendingCount !== 1 ? 's' : ''} waiting on you
            </p>
          ) : null}
        </div>
        <Link to="/notifications">
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 shrink-0">
            All tasks <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      <div className="px-3 pb-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading tasks...</p>
        ) : actionItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60">
              <Check className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">All tasks complete</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Invites and alerts will show up here
            </p>
          </div>
        ) : (
          <ul className="overflow-hidden divide-y divide-border/70 rounded-xl border border-border/70 bg-muted/10">
            <AnimatePresence initial={false}>
              {actionItems.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onOpen={handleOpen}
                  onMarkDone={handleMarkDone}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}

        {hiddenCount > 0 ? (
          <Link
            to="/notifications"
            className="mt-2 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            +{hiddenCount} more task{hiddenCount !== 1 ? 's' : ''}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function TodoRow({ todo, onOpen, onMarkDone }) {
  const [phase, setPhase] = useState('idle');
  const title = formatTodoTitle(todo);
  const categoryLabel = getTodoCategoryLabel(todo);
  const actionHint = getTodoActionHint(todo);
  const hasTarget = Boolean(todo.action_url?.trim() || todo.system_id?.trim());
  const isChecked = phase === 'checked' || phase === 'exiting';
  const isBusy = phase !== 'idle';

  const handleComplete = async (event) => {
    event.stopPropagation();
    if (isBusy) return;

    setPhase('checked');

    window.setTimeout(() => {
      setPhase('exiting');
    }, CHECK_HOLD_MS);
  };

  const handleExitComplete = async () => {
    if (phase !== 'exiting') return;

    try {
      await onMarkDone(todo);
    } catch {
      setPhase('idle');
      toast.error('Failed to mark task as done.');
    }
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 1, x: 0 }}
      animate={
        phase === 'exiting'
          ? { x: '105%', opacity: 0 }
          : { x: 0, opacity: isChecked ? 0.72 : 1 }
      }
      transition={
        phase === 'exiting'
          ? { duration: EXIT_DURATION, ease: [0.32, 0.72, 0, 1] }
          : { duration: 0.2, ease: 'easeOut' }
      }
      onAnimationComplete={() => {
        if (phase === 'exiting') {
          void handleExitComplete();
        }
      }}
      className={cn(
        'group flex items-start gap-3 px-3 py-2.5 transition-colors',
        !isBusy && 'hover:bg-muted/30'
      )}
    >
      <button
        type="button"
        onClick={handleComplete}
        disabled={isBusy}
        aria-label={`Mark "${title}" as done`}
        aria-pressed={isChecked}
        className={cn(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isChecked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/35 hover:border-primary hover:bg-primary/10'
        )}
      >
        <AnimatePresence initial={false}>
          {isChecked ? (
            <motion.span
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 560, damping: 28 }}
              className="flex items-center justify-center"
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => !isBusy && onOpen(todo)}
          disabled={isBusy}
          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm disabled:cursor-default"
        >
          <motion.p
            animate={
              isChecked
                ? { opacity: 0.55 }
                : { opacity: 1 }
            }
            transition={{ duration: 0.2 }}
            className={cn(
              'text-sm font-medium leading-snug transition-[color,text-decoration-color] duration-200 line-clamp-2',
              isChecked
                ? 'text-muted-foreground line-through decoration-muted-foreground/60'
                : 'text-foreground group-hover:text-primary'
            )}
          >
            {title}
          </motion.p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors duration-200',
                isChecked ? 'bg-muted-foreground/50' : 'bg-primary/70'
              )}
              />
              {categoryLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>{actionHint}</span>
            {todo.created_date ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {formatDistanceToNow(new Date(todo.created_date), { addSuffix: true })}
                </span>
              </>
            ) : null}
          </div>
        </button>
      </div>

      {hasTarget ? (
        <button
          type="button"
          onClick={() => !isBusy && onOpen(todo)}
          disabled={isBusy}
          aria-label={`Open ${title}`}
          className={cn(
            'mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-all',
            'opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground',
            'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isBusy && 'pointer-events-none opacity-0'
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </motion.li>
  );
}
