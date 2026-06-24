import { useEffect, useRef } from 'react';

const EDGE_THRESHOLD = 56;
const EDGE_SCROLL_SPEED = 14;

function isPointerOverContainer(container, x, y) {
  const rect = container.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function canScrollVertically(container, deltaY) {
  if (deltaY === 0) return false;
  const maxScrollTop = container.scrollHeight - container.clientHeight;
  if (maxScrollTop <= 0) return false;
  if (deltaY < 0) return container.scrollTop > 0;
  return container.scrollTop < maxScrollTop;
}

function scrollContainerVertically(container, deltaY) {
  const maxScrollTop = container.scrollHeight - container.clientHeight;
  container.scrollTop = Math.max(0, Math.min(maxScrollTop, container.scrollTop + deltaY));
}

function autoScrollNearEdge(container, pointerY) {
  const rect = container.getBoundingClientRect();
  const maxScrollTop = container.scrollHeight - container.clientHeight;
  if (maxScrollTop <= 0) return;

  const distanceFromTop = pointerY - rect.top;
  const distanceFromBottom = rect.bottom - pointerY;

  if (distanceFromTop < EDGE_THRESHOLD && container.scrollTop > 0) {
    const intensity = 1 - distanceFromTop / EDGE_THRESHOLD;
    container.scrollTop -= Math.ceil(EDGE_SCROLL_SPEED * intensity);
    return;
  }

  if (distanceFromBottom < EDGE_THRESHOLD && container.scrollTop < maxScrollTop) {
    const intensity = 1 - distanceFromBottom / EDGE_THRESHOLD;
    container.scrollTop += Math.ceil(EDGE_SCROLL_SPEED * intensity);
  }
}

/**
 * Enables touchpad/mouse-wheel scrolling and edge auto-scroll on nested panels
 * while a dnd-kit drag is active (pointer capture blocks native scroll).
 */
export function useDragScrollContainers(isDragging, containerRefs) {
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isDragging) return undefined;

    const handlePointerMove = (event) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) return undefined;

    const getContainers = () => containerRefs
      .map((ref) => ref.current)
      .filter(Boolean);

    const handleWheel = (event) => {
      const containers = getContainers();
      if (containers.length === 0) return;

      const { clientX, clientY, deltaY } = event;
      pointerRef.current = { x: clientX, y: clientY };

      for (const container of containers) {
        if (!isPointerOverContainer(container, clientX, clientY)) continue;
        if (!canScrollVertically(container, deltaY)) continue;

        scrollContainerVertically(container, deltaY);
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isDragging, containerRefs]);

  useEffect(() => {
    if (!isDragging) return undefined;

    const getContainers = () => containerRefs
      .map((ref) => ref.current)
      .filter(Boolean);

    const tick = () => {
      const { x, y } = pointerRef.current;
      const containers = getContainers();

      for (const container of containers) {
        if (!isPointerOverContainer(container, x, y)) continue;
        autoScrollNearEdge(container, y);
      }
    };

    const intervalId = window.setInterval(tick, 16);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isDragging, containerRefs]);
}
