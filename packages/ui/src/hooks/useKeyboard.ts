import { useEffect } from 'react';

/**
 * Subscribes to global keydown events with a bindings map. Cleans up on
 * unmount. We ignore events when the focus is in a text input/textarea so
 * typing doesn't accidentally fire shortcuts.
 *
 * Usage:
 *   useKeyboard({
 *     a: () => voteLeft(),
 *     ArrowLeft: () => voteLeft(),
 *     d: () => voteRight(),
 *   });
 */
export function useKeyboard(bindings: Record<string, () => void>) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const handler = bindings[event.key] ?? bindings[event.key.toLowerCase()];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bindings]);
}
