import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Nav } from './Nav';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Nav />
    </MemoryRouter>
  );
}

describe('Nav', () => {
  test('renders the brand and primary nav links', () => {
    renderAt('/compare');
    expect(screen.getByRole('link', { name: /aega\.art/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^vote$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^leaderboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^tags$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^providers$/i })).toBeInTheDocument();
  });

  test('marks the current route as active via aria-current', () => {
    renderAt('/leaderboard');
    const active = screen.getByRole('link', { name: /^leaderboard$/i });
    // NavLink sets aria-current="page" on the active link.
    expect(active).toHaveAttribute('aria-current', 'page');
  });

  test('non-current routes do not have aria-current', () => {
    renderAt('/leaderboard');
    expect(screen.getByRole('link', { name: /^vote$/i })).not.toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
