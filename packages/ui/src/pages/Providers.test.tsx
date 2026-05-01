import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProvidersPage } from './Providers';
import * as clientModule from '../api/client';

describe('ProvidersPage', () => {
  test('renders provider standings', async () => {
    vi.spyOn(clientModule.api, 'providersLeaderboard').mockResolvedValue({
      providers: [
        {
          provider: 'imagen',
          label: 'Imagen',
          imageCount: 4,
          avgElo: 1412.5,
          maxElo: 1600,
          totalVotes: 30,
          topImage: {
            id: '00000000-0000-0000-0000-000000000001',
            url: 'https://img/top.png',
            prompt: 'top prompt',
            tags: [],
            elo: 1600,
            votes: 12,
            created_at: new Date().toISOString(),
            provider: 'imagen',
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <ProvidersPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByRole('list', { name: /provider standings/i })).toBeInTheDocument()
    );
    expect(screen.getByText('Imagen')).toBeInTheDocument();
    expect(screen.getByText('1413')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /1600 elo top image/i })).toHaveAttribute(
      'href',
      '/images/00000000-0000-0000-0000-000000000001'
    );
  });
});
