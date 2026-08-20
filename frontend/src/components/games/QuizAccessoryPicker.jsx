// @ts-nocheck
import React from 'react';
import { cn } from '@/lib/utils';
import QuizAvatar from '@/components/games/QuizAvatar';
import { QUIZ_ACCESSORIES, normalizeQuizAccessoryId } from '@/components/games/QuizAccessories';
import { glassDialogMutedText, glassDialogTitleText } from '@/components/layout/glassStyles';

export default function QuizAccessoryPicker({
  profileImage,
  profileImageCrop = null,
  name = '',
  accessoryId = null,
  onSelect,
  disabled = false,
  compact = false,
}) {
  const selected = normalizeQuizAccessoryId(accessoryId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <QuizAvatar
          profileImage={profileImage}
          profileImageCrop={profileImageCrop}
          accessoryId={selected}
          name={name}
          size={compact ? 'lg' : 'xl'}
        />
        <div className="min-w-0">
          <p className={cn('font-semibold', glassDialogTitleText)}>Quiz look</p>
          <p className={cn('text-xs', glassDialogMutedText)}>
            Your profile photo plus one optional accessory. Saved for the next game you join.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(null)}
          className={cn(
            'rounded-xl border px-1 py-2 text-[10px] font-semibold',
            selected == null ? 'border-primary bg-primary/10' : 'border-border bg-background/60',
          )}
        >
          None
        </button>
        {QUIZ_ACCESSORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            title={item.label}
            onClick={() => onSelect(item.id)}
            className={cn(
              'rounded-xl border px-1 py-1 flex flex-col items-center gap-1',
              selected === item.id ? 'border-primary bg-primary/10' : 'border-border bg-background/60',
            )}
          >
            <QuizAvatar accessoryId={item.id} name={name} size="sm" profileImage={profileImage} profileImageCrop={profileImageCrop} />
            <span className="text-[9px] leading-tight font-medium text-center truncate w-full">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
