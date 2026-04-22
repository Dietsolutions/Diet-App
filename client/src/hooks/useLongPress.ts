import { useRef, useCallback } from 'react';
import { hapticFeedback } from '../utils/haptic';

export function useLongPress(onLongPress: () => void, delay = 500) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const didFire = useRef(false);

  const start = useCallback(() => {
    didFire.current = false;
    timer.current = setTimeout(() => {
      didFire.current = true;
      hapticFeedback(50);
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
  }, []);

  const contextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onLongPress();
    },
    [onLongPress]
  );

  return {
    didFire,
    handlers: {
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onTouchStart: start,
      onTouchEnd: cancel,
      onContextMenu: contextMenu,
    },
  };
}
