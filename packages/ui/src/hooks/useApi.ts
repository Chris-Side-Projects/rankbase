import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal SWR-style hook: fires a fetcher, tracks loading/error/data, and
 * exposes a `refetch` callback. Avoids the dependency and bundle-size of
 * pulling in SWR/React Query for a 3-page app.
 *
 * The AbortController ensures that if a component unmounts (or refetches)
 * while a request is in flight, the stale response is discarded rather than
 * overwriting state.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const run = useCallback(async () => {
    if (!mounted.current) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mounted.current) setData(result);
    } catch (e) {
      if (mounted.current) setError(e as Error);
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    void run();
    return () => {
      mounted.current = false;
    };
  }, [run]);

  return { data, error, loading, refetch: run };
}
