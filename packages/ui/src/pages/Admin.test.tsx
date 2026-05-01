import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from './Admin';
import * as clientModule from '../api/client';

describe('AdminPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('renders the moderation queue with a stored token', async () => {
    sessionStorage.setItem('aega_art_admin_token', 'secret');
    vi.spyOn(clientModule.api, 'adminStats').mockResolvedValue({ providers: [] });
    vi.spyOn(clientModule.api, 'adminReports').mockResolvedValue({
      reports: [],
      limit: 24,
      offset: 0,
      status: 'open',
    });
    vi.spyOn(clientModule.api, 'adminImages').mockResolvedValue({
      limit: 24,
      offset: 0,
      hidden: 'all',
      images: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          url: 'https://img/admin.png',
          prompt: 'review me',
          tags: [],
          elo: 1000,
          votes: 0,
          created_at: new Date().toISOString(),
          provider: 'imagen',
          moderation_score: 0.62,
          hidden: false,
        },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('review me')).toBeInTheDocument());
    expect(screen.getByText('62% score')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });

  test('renders community reports', async () => {
    sessionStorage.setItem('aega_art_admin_token', 'secret');
    vi.spyOn(clientModule.api, 'adminStats').mockResolvedValue({ providers: [] });
    vi.spyOn(clientModule.api, 'adminImages').mockResolvedValue({
      images: [],
      limit: 24,
      offset: 0,
      hidden: 'all',
    });
    vi.spyOn(clientModule.api, 'adminReports').mockResolvedValue({
      limit: 24,
      offset: 0,
      status: 'open',
      reports: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          image_id: '00000000-0000-0000-0000-000000000001',
          reason: 'offensive',
          notes: 'not okay',
          status: 'open',
          created_at: new Date().toISOString(),
          images: {
            id: '00000000-0000-0000-0000-000000000001',
            url: 'https://img/report.png',
            prompt: 'reported image',
            tags: [],
            elo: 1000,
            votes: 0,
            created_at: new Date().toISOString(),
            provider: 'dalle',
            moderation_score: 0.2,
            hidden: false,
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reports' }));
    await waitFor(() => expect(screen.getByText('reported image')).toBeInTheDocument());
    expect(screen.getByText('not okay')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reviewed' }).length).toBeGreaterThan(0);
  });
});
