import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TagDetailPage } from './TagDetail';
import * as clientModule from '../api/client';

describe('TagDetailPage', () => {
  test('renders images for a tag route', async () => {
    vi.spyOn(clientModule.api, 'tagImages').mockResolvedValue({
      tag: 'sunset sky',
      limit: 20,
      offset: 0,
      images: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          url: 'https://img/tag.png',
          prompt: 'tagged prompt',
          tags: ['sunset sky'],
          elo: 1320,
          votes: 3,
          created_at: new Date().toISOString(),
          provider: 'stability',
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/tags/sunset%20sky']}>
        <Routes>
          <Route path="/tags/:tag" element={<TagDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sunset sky/i })).toBeInTheDocument()
    );
    expect(screen.getByText('tagged prompt')).toBeInTheDocument();
    expect(screen.getByText('Stability')).toBeInTheDocument();
    expect(screen.getByText('1320 ELO')).toBeInTheDocument();
  });
});
