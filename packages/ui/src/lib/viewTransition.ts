/**
 * Wrapper around the View Transitions API.
 *
 * If the browser supports it (Chrome 111+, Safari 18+), updates wrapped in
 * `withViewTransition` get an automatic crossfade between old and new DOM.
 * Browsers without support call the callback synchronously — same UX as
 * before, no animation.
 *
 * Honors prefers-reduced-motion: skipped when the user has it set.
 */

export function withViewTransition(callback: () => void | Promise<void>): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // `startViewTransition` exists on modern Document but TypeScript may or
  // may not know about it depending on the lib target. Cast cautiously.
  const start = (document as Document & {
    startViewTransition?: (cb: () => void | Promise<void>) => unknown;
  }).startViewTransition;
  if (reduced || typeof start !== 'function') {
    void callback();
    return;
  }
  start.call(document, callback);
}
