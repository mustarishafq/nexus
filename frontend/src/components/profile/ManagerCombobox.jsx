import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import db from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getDisplayName } from '@/lib/profile';

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function sortByDisplayName(a, b) {
  return getDisplayName(a).localeCompare(getDisplayName(b));
}

function matchesLocalSearch(user, term) {
  const haystack = [
    user.name,
    user.full_name,
    user.email,
    user.job_title,
    user.department,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(term);
}

export default function ManagerCombobox({
  value,
  onChange,
  excludeUserId,
  id,
  selectedLabel,
  users: usersProp,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const listRef = useRef(null);
  const useLocalUsers = Array.isArray(usersProp);

  const { data: directoryData, isLoading: directoryLoading } = useQuery({
    queryKey: ['manager-picker-directory', debouncedSearch],
    queryFn: () =>
      db.getPeopleDirectory({
        limit: 100,
        sort: 'full_name',
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
      }),
    staleTime: 30_000,
    enabled: open && !useLocalUsers,
  });

  const options = useMemo(() => {
    const source = useLocalUsers
      ? usersProp
      : (Array.isArray(directoryData?.users) ? directoryData.users : []);

    const term = search.trim().toLowerCase();
    const filtered = source.filter((user) => {
      if (String(user.id) === String(excludeUserId)) {
        return false;
      }
      if (useLocalUsers && term) {
        return matchesLocalSearch(user, term);
      }
      return true;
    });

    return [...filtered].sort(sortByDisplayName);
  }, [usersProp, useLocalUsers, directoryData?.users, excludeUserId, search]);

  const selected = options.find((user) => String(user.id) === String(value))
    || (useLocalUsers ? usersProp.find((user) => String(user.id) === String(value)) : null);
  const displayLabel = selected
    ? getDisplayName(selected)
    : selectedLabel || (value ? 'Selected manager' : 'Select manager');
  const isLoading = !useLocalUsers && directoryLoading;

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
