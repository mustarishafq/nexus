import db from '@/api/apiClient';
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** GIPHY search popover for comment composers. Results come through the Laravel proxy. */
export default function GifPicker({ onSelect, disabled = false, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gif-search', debouncedQuery],
    queryFn: () => db.feed.searchGifs(debouncedQuery),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const gifs = Array.isArray(data?.gifs) ? data.gifs : [];
  const enabled = data?.enabled !== false;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold tracking-tight text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40',
            triggerClassName
          )}
          aria-label="Add a GIF"
          title="GIF"
        >
          <span className="rounded border border-current px-1 leading-tight">GIF</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[min(20rem,calc(100vw-2rem))] p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search GIFs"
            className="h-8 pl-8 text-sm"
            autoFocus
          />
        </div>

        <div className="h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : !enabled ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">GIF search isn&apos;t set up yet.</p>
          ) : isError ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">Couldn&apos;t load GIFs. Try again.</p>
          ) : gifs.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No GIFs found.</p>
          ) : (
            <div className="columns-2 gap-1.5 [&>*]:mb-1.5">
              {gifs.map((gif) => (
                <button
                  key={gif.id || gif.url}
                  type="button"
                  onClick={() => {
                    onSelect?.({ type: 'gif', url: gif.url, width: gif.width, height: gif.height });
                    setOpen(false);
                    setQuery('');
                  }}
                  className="block w-full overflow-hidden rounded-md bg-muted transition-opacity hover:opacity-80"
                  title={gif.title}
                >
                  <img
                    src={gif.preview_url}
                    alt={gif.title || 'GIF'}
                    loading="lazy"
                    className="block w-full"
                    style={gif.width && gif.height ? { aspectRatio: `${gif.width} / ${gif.height}` } : undefined}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-1.5 text-right text-[10px] font-medium text-muted-foreground">Powered by GIPHY</p>
      </PopoverContent>
    </Popover>
  );
}
