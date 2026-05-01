import { describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboard } from './useKeyboard';

function press(key: string, target?: EventTarget) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  (target ?? window).dispatchEvent(event);
}

describe('useKeyboard', () => {
  test('fires the bound handler on matching key', () => {
    const a = vi.fn();
    renderHook(() => useKeyboard({ a }));
    press('a');
    expect(a).toHaveBeenCalledOnce();
  });

  test('matches case-insensitively', () => {
    const a = vi.fn();
    renderHook(() => useKeyboard({ a }));
    press('A');
    expect(a).toHaveBeenCalledOnce();
  });

  test('skips when focus is inside an input', () => {
    const handler = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    renderHook(() => useKeyboard({ a: handler }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  test('skips when meta/ctrl/alt is held', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ a: handler }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  test('cleans up the listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboard({ a: handler }));
    unmount();
    press('a');
    expect(handler).not.toHaveBeenCalled();
  });
});
