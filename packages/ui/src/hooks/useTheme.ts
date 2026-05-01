import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/**
 * Theme state, synced to localStorage and <html data-theme="..."> so the
 * token CSS variables swap immediately.
 *
 * The no-flash script in index.html already set the attribute before React
 * mounted, so initial paint matches the eventual state and we never flicker.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'dark';
    return (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
  });

  const apply = useCallback((next: Theme) => {
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private browsing etc. — silently fall back to no-persist mode.
    }
    setTheme(next);
  }, []);

  const toggle = useCallback(() => {
    apply(theme === 'dark' ? 'light' : 'dark');
  }, [theme, apply]);

  // If the user hasn't explicitly picked a theme, follow system changes.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const listener = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) apply(e.matches ? 'light' : 'dark');
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [apply]);

  return { theme, toggle };
}
