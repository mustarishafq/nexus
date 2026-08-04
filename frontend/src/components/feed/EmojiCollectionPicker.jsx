import React, { useMemo, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    label: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😗', '😋', '😜', '🤪', '🤨', '🧐', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😢', '😭', '😤', '😠', '🤯', '😳', '🥵', '🥶', '😱', '😨', '🤗', '🤔', '🤭', '🤫', '😶', '😐', '😑', '😬', '🙄', '😴', '🤤', '😷', '🤒', '🤕'],
  },
  {
    id: 'gestures',
    label: 'Gestures',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦾', '👋', '🤚', '🖐️', '✋', '🖖', '👈', '👉', '👆', '👇', '☝️', '👊', '✊', '🤛', '🤜', '💅', '🤳'],
  },
  {
    id: 'hearts',
    label: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❣️', '💔', '❤️‍🔥', '💯', '✨', '⭐', '🌟', '💫', '⚡', '🔥', '💥'],
  },
  {
    id: 'celebration',
    label: 'Celebrate',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '🎯', '🚀', '💡', '📌', '✅', '☑️', '✔️', '❗', '❓', '💬', '🗨️', '📢', '🔔'],
  },
  {
    id: 'work',
    label: 'Work',
    emojis: ['💼', '💻', '🖥️', '📱', '⌨️', '🖱️', '📊', '📈', '📉', '🧾', '📝', '📋', '📁', '📂', '🗓️', '📅', '⏰', '⌛', '📦', '✉️', '📧', '📞', '🛠️', '⚙️', '🔧', '📎', '🔗'],
  },
  {
    id: 'food',
    label: 'Food',
    emojis: ['☕', '🍵', '🧋', '🥤', '🍺', '🍻', '🥂', '🍷', '🍕', '🍔', '🍟', '🌮', '🍣', '🍜', '🥗', '🍰', '🍪', '🍩', '🍫', '🍎', '🍌', '🍓', '🥑', '🌶️'],
  },
];

/**
 * Compact emoji collection for inserting into text fields (comments, etc).
 */
export default function EmojiCollectionPicker({
  onSelect,
  disabled = false,
  align = 'start',
  side = 'top',
  className,
  triggerClassName,
}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);

  const category = useMemo(
    () => EMOJI_CATEGORIES.find((entry) => entry.id === activeCategory) || EMOJI_CATEGORIES[0],
    [activeCategory]
  );

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            'h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground md:h-10 md:w-10',
            triggerClassName
          )}
          title="Emoji"
          aria-label="Open emoji collection"
        >
          <SmilePlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        className={cn('z-[200] w-[min(20rem,calc(100vw-2rem))] p-0', className)}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-border/50 px-2.5 py-2">
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {EMOJI_CATEGORIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActiveCategory(entry.id)}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  activeCategory === entry.id
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-2">
          {category.emojis.map((emoji) => (
            <button
              key={`${category.id}-${emoji}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect?.(emoji);
                // Keep open so people can pick several on mobile.
              }}
              className="inline-flex h-9 w-full items-center justify-center rounded-md text-lg transition-colors hover:bg-muted/70 active:scale-95"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
