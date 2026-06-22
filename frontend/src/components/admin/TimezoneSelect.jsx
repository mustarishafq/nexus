import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  filterTimezoneOptions,
  formatTimezoneLabel,
  getTimezoneOptions,
} from '@/lib/timezones';

const TIMEZONE_OPTIONS = getTimezoneOptions();

export default function TimezoneSelect({ value, onChange, id, className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(
    () => filterTimezoneOptions(TIMEZONE_OPTIONS, search),
    [search],
  );

  const displayLabel = value ? formatTimezoneLabel(value) : 'Select timezone...';

  const selectTimezone = (timezone) => {
    onChange(timezone);
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
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>
            {displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search timezones..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64">
            {filteredOptions.length === 0 ? (
              <CommandEmpty>No timezone found.</CommandEmpty>
            ) : null}
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => selectTimezone(option.value)}
              >
                <Check
                  className={cn('mr-2 h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')}
                />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
