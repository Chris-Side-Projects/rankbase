import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile widget wrapper.
 *
 * Loads the turnstile script once on first mount, renders an invisible
 * widget, and calls `onToken` when a token is issued. Reset is exposed
 * via an imperative ref so parents can force re-challenge after a vote.
 */
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const ensureScript = () =>
      new Promise<void>((resolve) => {
        if (window.turnstile) return resolve();
        const existing = document.querySelector(
          'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
        );
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });

    (async () => {
      await ensureScript();
      if (cancelled || !container.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: onToken,
        size: 'flexible',
      });
    })();

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* widget may already be gone */
        }
      }
    };
  }, [siteKey, onToken]);

  return <div ref={container} />;
}
