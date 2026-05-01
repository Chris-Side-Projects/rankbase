import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ImageDetailPage } from './ImageDetail';
import * as clientModule from '../api/client';

describe('ImageDetailPage', () => {
  test('renders image metadata and vote history', async () => {
    vi.spyOn(clientModule.api, 'imageDetail').mockResolvedValue({
      image: {
        id: '00000000-0000-0000-0000-000000000001',
        url: 'https://img/detail.png',
        prompt: 'detail prompt',
        tags: ['sunset'],
        elo: 1510.4,
        votes: 9,
        created_at: new Date().toISOString(),
        provider: 'dalle',
      },
      recentVotes: [
        {
          id: 'vote-1',
          created_at: new Date('2026-04-24T00:00:00Z').toISOString(),
          won: true,
          opponentId: '00000000-0000-0000-0000-000000000002',
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/images/00000000-0000-0000-0000-000000000001']}>
        <Routes>
          <Route path="/images/:id" element={<ImageDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /detail prompt/i })).toBeInTheDocument()
    );
    expect(screen.getByText('DALL-E')).toBeInTheDocument();
    expect(screen.getByText('1510 ELO')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'sunset' })).toHaveAttribute('href', '/tags/sunset');
    expect(screen.getByText('Won')).toBeInTheDocument();
  });
});
