import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export async function hapticFeedback(pattern: number | number[] = 50): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch { /* noop */ }
    return;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(pattern); } catch { /* noop */ }
  }
}

export async function hapticMedium(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch { /* noop */ }
    return;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(40); } catch { /* noop */ }
  }
}

export async function hapticHeavy(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch { /* noop */ }
    return;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate([30, 20, 60]); } catch { /* noop */ }
  }
}

export async function hapticSuccess(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try { await Haptics.notification({ type: NotificationType.Success }); } catch { /* noop */ }
    return;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate([20, 10, 20]); } catch { /* noop */ }
  }
}

export async function hapticError(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try { await Haptics.notification({ type: NotificationType.Error }); } catch { /* noop */ }
    return;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate([50, 20, 50, 20, 50]); } catch { /* noop */ }
  }
}
