import React from 'react';
import { cn } from '@/lib/utils';

/** Photo or GIF shown under a comment's text. */
export default function CommentAttachment({ attachment, className }) {
  if (!attachment?.url) return null;

  const isGif = attachment.type === 'gif';
  const hasSize = attachment.width > 0 && attachment.height > 0;

  const image = (
    <img
      src={attachment.url}
      alt={isGif ? 'GIF' : 'Comment photo'}
      loading="lazy"
      width={hasSize ? attachment.width : undefined}
      height={hasSize ? attachment.height : undefined}
      className="block max-h-60 w-auto max-w-full rounded-xl bg-muted object-contain"
      style={hasSize ? { aspectRatio: `${attachment.width} / ${attachment.height}` } : undefined}
    />
  );

  return (
    <div className={cn('mt-1.5 max-w-[16rem]', className)}>
      {isGif ? (
        image
      ) : (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block w-fit">
          {image}
        </a>
      )}
    </div>
  );
}
