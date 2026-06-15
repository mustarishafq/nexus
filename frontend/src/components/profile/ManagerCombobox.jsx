import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import db from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getDisplayName } from '@/lib/profile';

export default function ManagerCombobox({ value, onChange, excludeUserId, id, selectedLabel }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const listRef = useRef(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['manager-picker-users', search],
    queryFn: () => db.searchUsers(search.trim() || 'a', 100),
    staleTime: 30_000,
    enabled: open,
  });

  const options = useMemo(
    () => users.filter((user) => String(user.id) !== String(excludeUserId)),
    [users, excludeUserId]
  );

  const selected = options.find((user) => String(user.id) === String(value));
  const displayLabel = selected ? getDisplayName(selected) : selectedLabel || (value ? 'Selected manager' : 'Select manager');

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const selectManager = (managerId) => {
    onChange(managerId);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search colleague..."
            className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div
          ref={listRef}
          className="max-h-[280px] overflow-y-auto overscroll-contain p-1"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          onWheel={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
            onClick={() => selectManager(null)}
          >
            <X className="h-4 w-4 text-muted-foreground" />
            No manager
          </button>

          {isLoading ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Loading colleagues...</p>
          ) : null}

          {!isLoading && options.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No colleagues found.</p>
          ) : null}

          {options.map((user) => {
            const isSelected = String(value) === String(user.id);
            return (
              <button
                key={user.id}
                type="button"
                className={cn(
                  'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                  isSelected && 'bg-accent'
                )}
                onClick={() => selectManager(user.id)}
              >
                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                <div className="min-w-0">
                  <p className="truncate">{getDisplayName(user)}</p>
                  {user.job_title || user.department ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {[user.job_title, user.department].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
