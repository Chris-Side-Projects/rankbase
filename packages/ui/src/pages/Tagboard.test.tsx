import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TagboardPage } from './Tagboard';
import * as clientModule from '../api/client';

function renderPage() {
  return render(
    <MemoryRouter>
      <TagboardPage />
    </MemoryRouter>
  );
}

describe('TagboardPage', () => {
  test('renders the tag list', async () => {
    vi.spyOn(clientModule.api, 'tagboard').mockResolvedValue({
      tags: [
        { tag: 'sunset', score: 1500.4, image_count: 12, updated_at: new Date().toISOString() },
        { tag: 'ocean', score: 1340.9, image_count: 7, updated_at: new Date().toISOString() },
      ],
      limit: 20,
      offset: 0,
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole('list', { name: /tag rankings/i })).toBeInTheDocument());
    expect(screen.getByText('sunset')).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText('12 img')).toBeInTheDocument();
  });

  test('shows empty state when no tags', async () => {
    vi.spyOn(clientModule.api, 'tagboard').mockResolvedValue({ tags: [], limit: 20, offset: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no tag data yet/i)).toBeInTheDocument());
  });
});
