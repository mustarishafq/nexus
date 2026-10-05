import React from 'react';
import { parseQuotedText } from '@/lib/emailQuote';
import { cn } from '@/lib/utils';

function Segments({ segments }) {
  return segments.map((segment, index) => {
    if (segment.type === 'quote') {
      return (
        <blockquote key={index} className="my-1 border-l-2 border-border pl-3 text-muted-foreground">
          <Segments segments={segment.children} />
        </blockquote>
      );
    }
    return segment.value ? (
      <div key={index} className="whitespace-pre-wrap">
        {segment.value}
      </div>
    ) : null;
  });
}

/** Plain-text email body with ">" quotes drawn as Gmail-style vertical lines. */
export default function QuotedText({ text, className }) {
  return (
    <div className={cn('break-words font-sans text-sm leading-relaxed', className)}>
      <Segments segments={parseQuotedText(text)} />
    </div>
  );
}
