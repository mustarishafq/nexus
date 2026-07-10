import React from 'react';
import { Link } from 'react-router-dom';
import { isAllMention, splitMentionText } from '@/lib/mentions';
import { cn } from '@/lib/utils';

const mentionChipClassName =
  'mx-0.5 inline-flex max-w-full items-center rounded-md bg-primary/10 px-1.5 py-0.5 align-baseline text-xs font-medium text-primary';

export default function MentionText({ text, className }) {
  const parts = splitMentionText(text);

  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {parts.map((part, index) => {
        if (part.type === 'mention') {
          if (isAllMention(part.userId)) {
            return (
              <span key={`${part.userId}-${index}`} className={mentionChipClassName}>
                @{part.label}
              </span>
            );
          }

          return (
            <Link
              key={`${part.userId}-${index}`}
              to={`/people/${part.userId}`}
              className={cn(mentionChipClassName, 'hover:bg-primary/15 hover:underline')}
            >
              @{part.label}
            </Link>
          );
        }

        return <span key={`text-${index}`}>{part.value}</span>;
      })}
    </span>
  );
}
