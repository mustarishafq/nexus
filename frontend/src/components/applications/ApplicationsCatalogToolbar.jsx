import React from 'react';
import { LayoutGrid, List, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'issues', label: 'Needs attention' },
];

export default function ApplicationsCatalogToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  resultCount,
  totalCount,
  onlineCount,
  issueCount,
}) {
  const hasActiveFilters = Boolean(search.trim() || statusFilter !== 'all');

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search applications..."
            className="h-10 pl-9 pr-9"
            aria-label="Search applications"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.value;
              const count =
                filter.value === 'all'
                  ? totalCount
                  : filter.value === 'online'
                    ? onlineCount
                    : issueCount;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => onStatusFilterChange(filter.value)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:text-sm',
                    isActive
                      ? 'bg-background text-foreground shadow-sm scale-[1.02]'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {filter.label}
                  <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', viewMode === 'grid' && 'bg-background shadow-sm')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              onClick={() => onViewModeChange('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', viewMode === 'list' && 'bg-background shadow-sm')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              onClick={() => onViewModeChange('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={() => {
                onSearchChange('');
                onStatusFilterChange('all');
              }}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground tabular-nums">{resultCount}</span>
        {' '}of{' '}
        <span className="tabular-nums">{totalCount}</span>
        {' '}application{totalCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}
