import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function TagInput({
  value = [],
  onChange,
  placeholder = 'Add a tag...',
  maxTags = 10,
  maxLength = 50,
  id,
  className,
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const addTag = (raw) => {
    const tag = raw.trim();
    if (!tag || tag.length > maxLength) return;
    if (value.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setInput('');
      return;
    }
    if (value.length >= maxTags) return;
    onChange([...value, tag]);
    setInput('');
  };

  const removeTag = (tag) => {
    onChange(value.filter((item) => item !== tag));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag(input);
      return;
    }
    if (event.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const atMax = value.length >= maxTags;

  return (
    <div
      className={cn(
        'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-xs font-medium">
          {tag}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              removeTag(tag);
            }}
            className="rounded-sm p-0.5 hover:bg-muted"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {!atMax ? (
        <Input
          ref={inputRef}
          id={id}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={value.length === 0 ? placeholder : ''}
          maxLength={maxLength}
          className="h-7 min-w-[8rem] flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      ) : null}
    </div>
  );
}
