import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  test('renders an accessibly-labeled button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
  });

  test('clicking toggles the theme attribute and updates the label', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  test('persists choice to localStorage', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
