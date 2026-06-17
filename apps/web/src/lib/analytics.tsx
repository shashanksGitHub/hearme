'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';
import * as Sentry from '@sentry/browser';
import { env } from '@/env';

let initialized = false;

function ensureInit() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  if (env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: false, // we capture manually on route change
      person_profiles: 'identified_only',
    });
  }
  if (env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({ dsn: env.NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0 });
  }
}

/** Fire a product-analytics event (no-op if PostHog isn't configured). */
export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture(event, props);
  }
}

/** Associate events with a user id (call after sign-in). */
export function identify(id: string, props?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.identify(id, props);
  }
}

/** Mount once per layout — initializes analytics + tracks pageviews. */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    ensureInit();
  }, []);

  useEffect(() => {
    if (env.NEXT_PUBLIC_POSTHOG_KEY) posthog.capture('$pageview');
  }, [pathname]);

  return null;
}
