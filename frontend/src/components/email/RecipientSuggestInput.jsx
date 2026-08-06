import React, { useEffect, useId, useRef, useState } from 'react';
import db from '@/api/apiClient';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function activeToken(value) {
  const text = String(value || '');
  const parts = text.split(',');
  return (parts[parts.length - 1] || '').trim();
}

function replaceActiveToken(value, email) {
  const text = String(value || '');
  const lastComma = text.lastIndexOf(',');
  const prefix = lastComma >= 0 ? `${text.slice(0, lastComma + 1).replace(/\s*$/, ' ')}` : '';
  return `${prefix}${email}, `;
}

export default function RecipientSuggestInput({
  id,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  className,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const token = activeToken(value);
  const debouncedToken = useDebouncedValue(token, 250);

  useEffect(() => {
    if (debouncedToken.length < 1) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    db.mail.recipientSuggestions({ q: debouncedToken, limit: 8 })
      .then((payload) => {
        if (cancelled) return;
        const list = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
        setSuggestions(list);
        setHighlight(0);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedToken]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const showList = open && token.length > 0 && (loading || suggestions.length > 0);

  const pick = (suggestion) => {
    if (!suggestion?.email) return;
    onChange(replaceActiveToken(value, suggestion.email));
    setOpen(false);
    setSuggestions([]);
  };

  const onKeyDown = (event) => {
    if (!showList || suggestions.length === 0) {
      if (event.key === 'Escape') setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => (current - 1 + suggestions.length) % suggestions.length);
      return;
    }

    if (event.key === 'Enter' && suggestions[highlight]) {
      event.preventDefault();
      pick(suggestions[highlight]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        className={className}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md"
        >
          {loading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">Searching…</li>
          ) : null}
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.source}-${suggestion.email}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                className={cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors',
                  index === highlight ? 'bg-muted' : 'hover:bg-muted/60',
                )}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(suggestion);
                }}
              >
                <span className="truncate font-medium">
                  {suggestion.display_name || suggestion.email}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {suggestion.email}
                  {suggestion.source === 'history' ? ' · Recent' : ' · Directory'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
