import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

export default function VirtualList({
  items,
  estimateSize = 72,
  className = '',
  height = 480,
  overscan = 6,
  renderItem,
  getItemKey,
}) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index], index)
      : (index) => items[index]?.id ?? index,
  });

  return (
    <div
      ref={parentRef}
      className={cn('overflow-y-auto', className)}
      style={{ maxHeight: height }}
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
