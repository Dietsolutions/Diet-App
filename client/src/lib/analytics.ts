import posthog from 'posthog-js';

const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY  || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialised = false;

function optedIn(): boolean {
  const stored = localStorage.getItem('analytics_opted_in');
  return stored !== null ? stored === 'true' : true;
}

export function initAnalytics(): void {
  if (!POSTHOG_KEY) {
    if (import.meta.env.DEV) {
      console.warn('[Analytics] VITE_POSTHOG_KEY not set — events will not be sent');
    }
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host:                  POSTHOG_HOST,
    capture_pageview:          false,
    capture_pageleave:         true,
    autocapture:               false,
    persistence:               'localStorage',
    disable_session_recording: true,
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug();
    },
  });

  initialised = true;
}

export function identifyUser(
  userId: string,
  properties?: {
    planDuration?:   number;
    mealsPerDay?:    number;
    dietIntensity?:  string;
    mealPreference?: string;
  },
): void {
  if (!initialised || !optedIn()) return;
  posthog.identify(userId, {
    plan_duration:   properties?.planDuration,
    meals_per_day:   properties?.mealsPerDay,
    diet_intensity:  properties?.dietIntensity,
    meal_preference: properties?.mealPreference,
  });
}

export function resetUser(): void {
  if (!initialised) return;
  posthog.reset();
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialised || !optedIn()) return;
  posthog.capture(event, {
    ...properties,
    app_version: '1.0',
  });
}

export function trackPage(pageName: string): void {
  track('page_viewed', { page: pageName });
}
