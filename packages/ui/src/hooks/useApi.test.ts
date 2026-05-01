import { describe, expect, test, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from './useApi';

describe('useApi', () => {
  test('starts loading, then resolves to data', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 42 });
    const { result } = renderHook(() => useApi(fetcher, []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ value: 42 });
    expect(result.current.error).toBeNull();
  });

  test('captures errors from the fetcher', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useApi(fetcher, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  test('refetch re-runs the fetcher', async () => {
    let counter = 0;
    const fetcher = vi.fn().mockImplementation(async () => ++counter);
    const { result } = renderHook(() => useApi(fetcher, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('does not write state after unmount', async () => {
    let resolve: (v: unknown) => void = () => {};
    const fetcher = () => new Promise((r) => (resolve = r));
    const { unmount } = renderHook(() => useApi(fetcher, []));
    unmount();
    // Resolve after unmount; should not throw or warn.
    resolve('late');
    await new Promise((r) => setTimeout(r, 0));
  });
});
