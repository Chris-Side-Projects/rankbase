import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Toast } from './Toast';

describe('Toast', () => {
  test('renders the message inside an aria-live region', () => {
    render(<Toast message="saved" onClose={() => {}} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('saved');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  test('auto-dismisses after timeoutMs', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      render(<Toast message="hi" timeoutMs={1500} onClose={onClose} />);
      expect(onClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1500);
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  test('dismiss button calls onClose immediately', () => {
    // fireEvent (not userEvent) keeps this synchronous so we don't need to
    // wrestle with fake-timer / async-event coordination.
    const onClose = vi.fn();
    render(<Toast message="hi" timeoutMs={9_999} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
