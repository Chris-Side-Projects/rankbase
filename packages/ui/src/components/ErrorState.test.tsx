import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from './ErrorState';
import { ApiError } from '../api/client';

describe('ErrorState', () => {
  test('renders generic title + message for plain Error', () => {
    render(<ErrorState error={new Error('something broke')} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('something broke')).toBeInTheDocument();
  });

  test('renders rate-limit hint for 429 with retryAfter', () => {
    const err = new ApiError(
      429,
      { error: { code: 'RATE_LIMITED', message: 'slow down' }, requestId: 'rid-1' },
      30
    );
    render(<ErrorState error={err} />);
    expect(screen.getByText('Slow down')).toBeInTheDocument();
    expect(screen.getByText(/Try again in 30s/)).toBeInTheDocument();
  });

  test('shows requestId for support reference', () => {
    const err = new ApiError(500, {
      error: { code: 'INTERNAL', message: 'oops' },
      requestId: 'abc-123',
    });
    render(<ErrorState error={err} />);
    expect(screen.getByText('abc-123')).toBeInTheDocument();
  });

  test('clicking Retry calls the retry callback', async () => {
    const retry = vi.fn();
    render(<ErrorState error={new Error('x')} retry={retry} />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test('Retry button is omitted when no retry callback', () => {
    render(<ErrorState error={new Error('x')} />);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });
});
