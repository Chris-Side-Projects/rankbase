import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { LeaderboardPage } from './Leaderboard';
import * as clientModule from '../api/client';
import type { Period } from '../types';

const fakeImage = (id: string, elo: number) => ({
  id,
  url: `https://img/${id}.png`,
  prompt: `prompt ${id}`,
  tags: ['t1', 't2'],
  elo,
  votes: 5,
  created_at: new Date().toISOString(),
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderPage(initialPath = '/leaderboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LeaderboardPage />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe('LeaderboardPage', () => {
  beforeEach(() => vi.restoreAllMocks());

  test('shows skeletons while loading, then images', async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.spyOn(clientModule.api, 'leaderboard').mockReturnValue(
      new Promise((r) => (resolve = r as (v: unknown) => void))
    );
    renderPage();
    // Skeletons render aria-hidden so query is visual not semantic.
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull();

    resolve({
      images: [fakeImage('a', 1500), fakeImage('b', 1300)],
      limit: 20,
      offset: 0,
      period: 'all',
    });
    await waitFor(() =>
      expect(screen.getByRole('list', { name: /leaderboard/i })).toBeInTheDocument()
    );
    expect(screen.getByText('1500 ELO')).toBeInTheDocument();
    expect(screen.getByText('1300 ELO')).toBeInTheDocument();
  });

  test('shows empty state when no images', async () => {
    vi.spyOn(clientModule.api, 'leaderboard').mockResolvedValue({
      images: [],
      limit: 20,
      offset: 0,
      period: 'all',
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument());
  });

  test('shows ErrorState on fetch failure', async () => {
    vi.spyOn(clientModule.api, 'leaderboard').mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  test('Load more appends next page', async () => {
    const spy = vi
      .spyOn(clientModule.api, 'leaderboard')
      .mockImplementation(async (_limit?: number, offset?: number, period: Period = 'all') => {
        if (offset === 0) {
          // Full page so the "Load more" button is shown.
          const images = Array.from({ length: 20 }, (_, i) => fakeImage(`a${i}`, 1500 - i));
          return { images, limit: 20, offset: 0, period };
        }
        return { images: [fakeImage('z', 800)], limit: 20, offset: 20, period };
      });

    renderPage();
    await waitFor(() => expect(screen.getByText('1500 ELO')).toBeInTheDocument());
    expect(spy).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));
    await waitFor(() => expect(screen.getByText('800 ELO')).toBeInTheDocument());
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('reads the selected period from the URL', async () => {
    const spy = vi.spyOn(clientModule.api, 'leaderboard').mockResolvedValue({
      images: [fakeImage('week', 1700)],
      limit: 20,
      offset: 0,
      period: 'week',
    });

    renderPage('/leaderboard?period=week');

    await waitFor(() => expect(screen.getByText('1700 ELO')).toBeInTheDocument());
    expect(spy).toHaveBeenCalledWith(20, 0, 'week');
    expect(screen.getByRole('button', { name: /this week/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('switching period resets pagination and updates the URL', async () => {
    const spy = vi
      .spyOn(clientModule.api, 'leaderboard')
      .mockImplementation(async (_limit?: number, offset = 0, period: Period = 'all') => {
        if (period === 'week') {
          return { images: [fakeImage('week', 1700)], limit: 20, offset, period };
        }
        if (offset === 0) {
          const images = Array.from({ length: 20 }, (_, i) => fakeImage(`a${i}`, 1500 - i));
          return { images, limit: 20, offset: 0, period };
        }
        return { images: [fakeImage('z', 800)], limit: 20, offset: 20, period };
      });

    renderPage();
    await waitFor(() => expect(screen.getByText('1500 ELO')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));
    await waitFor(() => expect(screen.getByText('800 ELO')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /this week/i }));

    await waitFor(() => expect(screen.getByText('1700 ELO')).toBeInTheDocument());
    expect(screen.queryByText('800 ELO')).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(20, 0, 'week');
    expect(screen.getByTestId('location')).toHaveTextContent('/leaderboard?period=week');
  });
});
