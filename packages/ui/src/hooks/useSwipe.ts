import { useRef, type TouchEvent } from 'react';

/**
 * Touch-swipe gesture detector.
 *
 * Returns { onTouchStart, onTouchEnd } props you spread onto the swipeable
 * element. Fires the corresponding callback when the user releases past the
 * threshold along the horizontal axis. Vertical drift is ignored (with a
 * tolerance) so a slight diagonal swipe still counts as horizontal.
 *
 * Threshold defaults to 60 px — comfortable on mobile without being too
 * easy to trigger accidentally on a long press.
 */
export function useSwipe(
  handlers: { onSwipeLeft?: () => void; onSwipeRight?: () => void },
  thresholdPx = 60
) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent) => {
    const t = event.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (!start.current) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < thresholdPx) return;
    // Ignore mostly-vertical swipes
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) handlers.onSwipeLeft?.();
    else handlers.onSwipeRight?.();
  };

  return { onTouchStart, onTouchEnd };
}
