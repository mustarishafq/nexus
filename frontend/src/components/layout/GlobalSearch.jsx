import db from '@/api/apiClient';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Loader2, Search } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import { getDisplayName } from '@/lib/profile';
import RoleBadge from '@/components/users/RoleBadge';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { glassDialogFaintText, glassDialogInputStyles, glassDialogMutedText } from '@/components/layout/glassStyles';

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function GlobalSearch({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim());

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!debouncedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    db.searchUsers(debouncedQuery, 10)
      .then((users) => {
        if (!cancelled) {
          setResults(Array.isArray(users) ? users : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  const handleSelectUser = useCallback(
    (userId) => {
      onOpenChange(false);
      navigate(`/people/${userId}`);
    },
    [navigate, onOpenChange]
  );

  const handleSelectMyDashboard = useCallback(() => {
    onOpenChange(false);
    navigate('/');
  }, [navigate, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search people" shouldFilter={false}>
      <CommandInput
        placeholder="Search by display name, full name, email..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </span>
          ) : debouncedQuery ? (
            'No users found.'
          ) : (
            'Type a name or email to search.'
          )}
        </CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem value="my-dashboard" onSelect={handleSelectMyDashboard}>
            <LayoutDashboard className="text-muted-foreground" />
            <span>Go to my dashboard</span>
          </CommandItem>
        </CommandGroup>

        {results.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="People">
              {results.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${getDisplayName(user, '')} ${user.email || ''} ${user.id}`}
                  onSelect={() => handleSelectUser(user.id)}
                  className="gap-3"
                >
                  <UserAvatar user={user} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{getDisplayName(user)}</p>
                    {user.is_online ? (
                      <p className="truncate text-xs font-medium text-success">Online</p>
                    ) : user.department ? (
                      <p className="truncate text-xs text-muted-foreground">{user.department}</p>
                    ) : user.email ? (
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    ) : null}
                  </div>
                  <Badge variant="secondary" className="capitalize shrink-0 text-[10px]">
                    {user.role || 'user'}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

export function GlobalSearchTrigger({ onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex h-10 w-full items-center rounded-lg border pl-9 pr-3 text-left text-sm transition-colors',
        'hover:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        glassDialogInputStyles,
        className
      )}
    >
      <Search className={cn('absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', glassDialogFaintText)} />
      <span className={cn('truncate', glassDialogMutedText)}>Search people...</span>
      <kbd className={cn(
        'pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium sm:inline-flex',
        'border-border/70 bg-muted/60 text-foreground/70 dark:bg-muted dark:text-muted-foreground'
      )}>
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}

export function useGlobalSearchShortcut(onOpen) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
}
