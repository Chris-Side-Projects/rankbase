/**
 * Minimal analytics event dispatcher.
 *
 * No-op when VITE_ANALYTICS_ENDPOINT is unset. Otherwise POSTs a small JSON
 * body per event. Events use `navigator.sendBeacon` when available so they
 * survive page-unload — important for capturing the "user voted and
 * immediately navigated away" case.
 *
 * This intentionally ships no third-party SDK (Plausible, PostHog, GA).
 * If you want a full analytics suite, swap the `track` implementation or
 * load their script in index.html. Keeps the bundle small and avoids
 * third-party cookie baggage.
 */

const endpoint: string | undefined = import.meta.env.VITE_ANALYTICS_ENDPOINT;

export type AnalyticsEvent =
  | { type: 'pageview'; path: string }
  | { type: 'vote_cast'; elo_delta: number }
  | { type: 'vote_error'; code: string };

export function track(event: AnalyticsEvent): void {
  if (!endpoint) return;
  const body = JSON.stringify({ ...event, t: Date.now() });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      void fetch(endpoint, { method: 'POST', body, keepalive: true });
    }
  } catch {
    /* never break user flow for analytics */
  }
}
