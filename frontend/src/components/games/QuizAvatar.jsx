// @ts-nocheck
import React from 'react';
import { cn } from '@/lib/utils';
import { getCoverCropBackgroundStyle, toPublicFileUrl } from '@/lib/media';
import { QuizAccessoryLayer, normalizeQuizAccessoryId } from '@/components/games/QuizAccessories';
import { QUIZ_AVATAR_RING_CLASS } from '@/lib/quizQuestion';

const SIZES = {
  sm: 36,
  md: 48,
  lg: 64,
  xl: 88,
};

export default function QuizAvatar({
  profileImage,
  profileImageCrop = null,
  accessoryId = null,
  name = '',
  size = 'md',
  className,
}) {
  const px = typeof size === 'number' ? size : (SIZES[size] || SIZES.md);
  const url = toPublicFileUrl(profileImage);
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const resolvedAccessoryId = normalizeQuizAccessoryId(accessoryId);

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: px, height: px }}
      title={name || undefined}
    >
      <div
        className={cn('absolute inset-0 overflow-hidden rounded-full bg-white/25 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]', QUIZ_AVATAR_RING_CLASS)}
        style={url ? getCoverCropBackgroundStyle(url, profileImageCrop, { fullImageFit: 'cover' }) : undefined}
      >
        {!url && (
          <span className="flex h-full w-full items-center justify-center text-white font-black" style={{ fontSize: px * 0.4 }}>
            {initial}
          </span>
        )}
      </div>
      {resolvedAccessoryId ? (
        <div
          className="pointer-events-none absolute inset-0 overflow-visible"
          style={{ transform: 'scale(1.45) translateY(-6%)' }}
        >
          <QuizAccessoryLayer id={resolvedAccessoryId} />
        </div>
      ) : null}
    </div>
  );
}
