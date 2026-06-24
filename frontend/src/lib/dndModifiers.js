import { getEventCoordinates } from '@dnd-kit/utilities';

/**
 * Keeps the drag overlay centered on the pointer. Required when DnD runs inside
 * transformed containers such as Radix dialogs (translate centering).
 */
export function snapCenterToCursor({ activatorEvent, draggingNodeRect, transform }) {
  if (!draggingNodeRect || !activatorEvent) {
    return transform;
  }

  const coordinates = getEventCoordinates(activatorEvent);
  if (!coordinates) {
    return transform;
  }

  const offsetX = coordinates.x - draggingNodeRect.left - draggingNodeRect.width / 2;
  const offsetY = coordinates.y - draggingNodeRect.top - draggingNodeRect.height / 2;

  return {
    ...transform,
    x: transform.x + offsetX,
    y: transform.y + offsetY,
  };
}
