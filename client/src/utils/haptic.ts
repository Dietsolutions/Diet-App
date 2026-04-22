/**
 * Safe haptic feedback wrapper.
 *
 * navigator.vibrate is not supported on iOS Safari at all — calling it
 * unconditionally throws on some older iOS versions. This wrapper silently
 * no-ops when the API is unavailable (iOS, Firefox desktop, some WebViews).
 */
export function hapticFeedback(pattern: number | number[] = 50): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently ignore — vibration not available
    }
  }
}
