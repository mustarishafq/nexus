import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { History, Loader2 } from 'lucide-react';
import db from '@/api/apiClient';
import MentionText from '@/components/feed/MentionText';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function PostEditHistory({ postId, editedAt, className }) {
  const { data, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: ['post-edits', postId],
    queryFn: () => db.feed.listPostEdits(postId),
    enabled: false,
    staleTime: 30_000,
  });

  const edits = Array.isArray(data?.edits) ? data.edits : [];
  const editedLabel = editedAt
    ? `Edited ${formatDistanceToNow(new Date(editedAt), { addSuffix: true })}`
    : 'Edited';

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) refetch();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 whitespace-nowrap text-[10px] text-muted-foreground transition-colors hover:text-foreground md:text-[11px]',
            className
          )}
          title="View edit history"
        >
          <History className="h-3 w-3" />
          {editedLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border/60 px-3 py-2">
          <p className="text-xs font-medium">Edit history</p>
          <p className="text-[11px] text-muted-foreground">Previous versions of this post</p>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {isLoading || isFetching ? (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading history...
            </div>
          ) : isError ? (
            <div className="space-y-2 px-2 py-3">
              <p className="text-xs text-destructive">Could not load edit history.</p>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : edits.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No previous versions yet.</p>
          ) : (
            <ul className="space-y-2">
              {edits.map((edit, index) => (
                <li key={edit.id} className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Version {edits.length - index}
                    </span>
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {edit.created_date
                        ? formatDistanceToNow(new Date(edit.created_date), { addSuffix: true })
                        : ''}
                    </span>
                  </div>
                  {edit.body ? (
                    <MentionText text={edit.body} className="text-xs" />
                  ) : (
                    <p className="text-xs italic text-muted-foreground">Empty post</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
