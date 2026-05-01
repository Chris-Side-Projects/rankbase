import { useEffect } from 'react';

/**
 * Warms the browser image cache for the given URLs by constructing
 * Image() instances. By the time the user clicks vote and we render the
 * next pair, those images are already decoded.
 *
 * No-op for empty / null URLs.
 */
export function useImagePreload(urls: Array<string | undefined | null>) {
  useEffect(() => {
    const valid = urls.filter((u): u is string => Boolean(u));
    if (valid.length === 0) return;
    const imgs: HTMLImageElement[] = valid.map((url) => {
      const img = new Image();
      img.src = url;
      return img;
    });
    return () => {
      // Best-effort cancel: clearing src lets the browser drop the request
      // if it hasn't started yet. If it's already in flight, we just let it
      // finish — it'll land in the cache and may help later anyway.
      for (const img of imgs) img.src = '';
    };
    // We intentionally take the array's contents as the dep, not the
    // identity, so callers don't need useMemo just to trigger us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, urls);
}
