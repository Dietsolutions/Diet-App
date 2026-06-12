import { useRef, useCallback, useEffect } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // px pull distance to trigger refresh
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 72,
  disabled = false,
}: PullToRefreshOptions) {
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const refreshing = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || refreshing.current) return;
    const el = containerRef.current;
    if (!el) return;
    // Only trigger when scrolled to top
    if (el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = false;
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || refreshing.current || startY.current === null) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 4) { startY.current = null; return; }

    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) return;

    pulling.current = true;
    const progress = Math.min(dy / threshold, 1);
    const translateY = Math.min(dy * 0.45, threshold * 0.6);

    if (indicatorRef.current) {
      indicatorRef.current.style.transform = `translateY(${translateY}px) scale(${0.6 + progress * 0.4})`;
      indicatorRef.current.style.opacity = String(progress);
    }

    // Prevent default scroll overscroll only when we own the gesture
    if (dy > 8) e.preventDefault();
  }, [disabled, threshold]);

  const handleTouchEnd = useCallback(async (e: TouchEvent) => {
    if (disabled || !pulling.current || startY.current === null) return;

    const dy = e.changedTouches[0].clientY - startY.current;
    startY.current = null;
    pulling.current = false;

    if (dy < threshold) {
      // Snap back
      if (indicatorRef.current) {
        indicatorRef.current.style.transform = 'translateY(-40px) scale(0.6)';
        indicatorRef.current.style.opacity = '0';
      }
      return;
    }

    // Trigger refresh
    refreshing.current = true;
    if (indicatorRef.current) {
      indicatorRef.current.style.transform = `translateY(20px) scale(1)`;
      indicatorRef.current.style.opacity = '1';
      indicatorRef.current.dataset.spinning = 'true';
    }

    try {
      await onRefresh();
    } finally {
      refreshing.current = false;
      if (indicatorRef.current) {
        indicatorRef.current.dataset.spinning = 'false';
        indicatorRef.current.style.transform = 'translateY(-40px) scale(0.6)';
        indicatorRef.current.style.opacity = '0';
      }
    }
  }, [disabled, threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, indicatorRef };
}
