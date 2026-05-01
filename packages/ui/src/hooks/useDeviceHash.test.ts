import { describe, expect, test } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDeviceHash } from './useDeviceHash';

describe('useDeviceHash', () => {
  test('returns null until clientIp is provided', () => {
    const { result } = renderHook(() => useDeviceHash(undefined));
    expect(result.current).toBeNull();
  });

  test('computes a hex hash once clientIp is provided', async () => {
    const { result } = renderHook(() => useDeviceHash('1.2.3.4'));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatch(/^[0-9a-f]{64}$/);
  });

  test('recomputes when clientIp changes', async () => {
    const { result, rerender } = renderHook(({ ip }) => useDeviceHash(ip), {
      initialProps: { ip: '1.2.3.4' as string | undefined },
    });
    await waitFor(() => expect(result.current).not.toBeNull());
    const first = result.current;
    rerender({ ip: '9.9.9.9' });
    await waitFor(() => expect(result.current).not.toBe(first));
  });
});
