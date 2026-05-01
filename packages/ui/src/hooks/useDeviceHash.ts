import { useEffect, useState } from 'react';

/**
 * Computes a stable device hash for vote deduplication.
 *
 * The backend's uniqueness constraint on (image_a, image_b, device_hash)
 * prevents a single device from voting on the same pair twice, so we need
 * something that's stable across sessions but not universally unique.
 * SHA-256(userAgent + clientIp) is good enough — it ties to the browser
 * install on this network, which is the fingerprint we want.
 */
export function useDeviceHash(clientIp: string | undefined): string | null {
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    if (!clientIp) return;
    (async () => {
      const raw = navigator.userAgent + '|' + clientIp;
      const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const hex = Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      setHash(hex);
    })();
  }, [clientIp]);

  return hash;
}
