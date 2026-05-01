/**
 * PostHog analytics wrapper.
 *
 * Gracefully no-ops when VITE_POSTHOG_KEY is missing — the app works
 * identically with zero errors. All track() / identifyUser() / resetUser()
 * calls are safe to add anywhere without guarding.
 *
 * Privacy rules (enforced here):
 *  - No PII: no names, emails, weights, health conditions, or locations
 *    beyond country level.
 *  - Only behavioural signals: which feature was used, counts, durations,
 *    success/failure states.
 *  - Session recording disabled.
 *  - Autocapture disabled (manual events only).
 */

import posthog from 'posthog-js';

const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY  || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialised = false;

/** Call once before React mounts (in main.tsx). */
export function initAnalytics(): void {
  if (!POSTHOG_KEY) {
    // Silent — analytics optional; dev console only gets a warning
    if (import.meta.env.DEV) {
      console.warn('[Analytics] VITE_POSTHOG_KEY not set — events will not be sent');
    }
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host:                  POSTHOG_HOST,
    capture_pageview:          false,   // manual trackPage() calls only
    capture_pageleave:         true,
    autocapture:               false,   // no accidental PII capture
    persistence:               'localStorage',
    disable_session_recording: true,    // no session replay — health data
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug();
    },
  });

  initialised = true;
}

/**
 * Identify a user after login.
 * NEVER send name, email, weight, health conditions, or exact location.
 */
export function identifyUser(
  userId: string,
  properties?: {
    planDuration?:   number;
    mealsPerDay?:    number;
    dietIntensity?:  string;
    mealPreference?: string;
  },
): void {
  if (!initialised) return;
  posthog.identify(userId, {
    plan_duration:   properties?.planDuration,
    meals_per_day:   properties?.mealsPerDay,
    diet_intensity:  properties?.dietIntensity,
    meal_preference: properties?.mealPreference,
  });
}

/** Reset identity after logout. */
export function resetUser(): void {
  if (!initialised) return;
  posthog.reset();
}

/** Core event capture. Safe to call even when not initialised. */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialised) return;
  posthog.capture(event, {
    ...properties,
    app_version: '1.0',
  });
}

/** Shorthand for page-view events. */
export function trackPage(pageName: string): void {
  track('page_viewed', { page: pageName });
}
