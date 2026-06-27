import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function UserSearchCombobox({
  users = [],
  value = '',
  onValueChange,
  placeholder = 'All users',
  searchPlaceholder = 'Search users...',
  className = '',
}) {
  const [open, setOpen] = useState(false);

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(value)),
    [users, value],
  );

  const label = selectedUser
    ? (selectedUser.full_name || selectedUser.name || selectedUser.email)
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-users"
                onSelect={() => {
                  onValueChange('');
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
                {placeholder}
              </CommandItem>
              {users.map((user) => {
                const userLabel = user.full_name || user.name || user.email;
                const selected = String(user.id) === String(value);

                return (
                  <CommandItem
                    key={user.id}
                    value={`${userLabel} ${user.email || ''}`}
                    onSelect={() => {
                      onValueChange(String(user.id));
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{userLabel}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
