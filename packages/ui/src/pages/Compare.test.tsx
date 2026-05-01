import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ComparePage } from './Compare';
import * as clientModule from '../api/client';

const fakeImage = (id: string, elo: number) => ({
  id,
  url: `https://img/${id}.png`,
  prompt: `prompt ${id}`,
  tags: [],
  elo,
  votes: 0,
  created_at: new Date().toISOString(),
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ComparePage />
    </MemoryRouter>
  );
}

describe('ComparePage', () => {
  beforeEach(() => vi.restoreAllMocks());

  test('shows the pair after fetch', async () => {
    vi.spyOn(clientModule.api, 'compare').mockResolvedValue({
      pair: [fakeImage('a', 1000), fakeImage('b', 1000)],
      turnstileSiteKey: null,
      clientIp: '1.2.3.4',
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /vote for: prompt/i }).length).toBe(2)
    );
  });

  test('shows empty state when fewer than 2 images exist', async () => {
    vi.spyOn(clientModule.api, 'compare').mockResolvedValue({
      pair: null,
      turnstileSiteKey: null,
      clientIp: '1.2.3.4',
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/not enough images yet/i)).toBeInTheDocument());
  });

  test('clicking an image submits a vote', async () => {
    vi.spyOn(clientModule.api, 'compare').mockResolvedValue({
      pair: [fakeImage('a', 1000), fakeImage('b', 1000)],
      turnstileSiteKey: null,
      clientIp: '1.2.3.4',
    });
    const voteSpy = vi
      .spyOn(clientModule.api, 'vote')
      .mockResolvedValue({ winnerId: 'a', loserId: 'b', newWinnerElo: 1016, newLoserElo: 984 });

    renderPage();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /vote for/i }).length).toBe(2));
    // Wait for device hash to populate (effect)
    await new Promise((r) => setTimeout(r, 10));

    const buttons = screen.getAllByRole('button', { name: /vote for/i });
    await userEvent.click(buttons[0]);

    await waitFor(() => expect(voteSpy).toHaveBeenCalledOnce());
    expect(voteSpy.mock.calls[0][0]).toMatchObject({ winnerId: 'a', loserId: 'b' });
  });

  test('keyboard A votes for the left image', async () => {
    vi.spyOn(clientModule.api, 'compare').mockResolvedValue({
      pair: [fakeImage('a', 1000), fakeImage('b', 1000)],
      turnstileSiteKey: null,
      clientIp: '1.2.3.4',
    });
    const voteSpy = vi
      .spyOn(clientModule.api, 'vote')
      .mockResolvedValue({ winnerId: 'a', loserId: 'b', newWinnerElo: 1016, newLoserElo: 984 });

    renderPage();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /vote for/i }).length).toBe(2));
    await new Promise((r) => setTimeout(r, 10));

    await userEvent.keyboard('a');
    await waitFor(() => expect(voteSpy).toHaveBeenCalledOnce());
    expect(voteSpy.mock.calls[0][0]).toMatchObject({ winnerId: 'a' });
  });

  test('shows ErrorState if compare fails', async () => {
    vi.spyOn(clientModule.api, 'compare').mockRejectedValue(new Error('compare boom'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('compare boom')).toBeInTheDocument();
  });
});
