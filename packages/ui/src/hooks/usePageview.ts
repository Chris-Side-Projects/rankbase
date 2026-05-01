import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '../lib/analytics';

/**
 * Fires a pageview event on every route change. No-op when analytics isn't
 * configured (track() returns early in that case).
 */
export function usePageview() {
  const location = useLocation();
  useEffect(() => {
    track({ type: 'pageview', path: location.pathname });
  }, [location.pathname]);
}
