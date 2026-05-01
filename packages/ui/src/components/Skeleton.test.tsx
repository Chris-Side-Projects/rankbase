import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  test('renders with default dimensions', () => {
    const { container } = render(<Skeleton />);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.style.width).toBe('100%');
    expect(span?.style.height).toBe('1em');
  });

  test('honors width/height/radius props', () => {
    const { container } = render(<Skeleton width="50px" height="20px" radius="4px" />);
    const span = container.querySelector('span') as HTMLSpanElement;
    expect(span.style.width).toBe('50px');
    expect(span.style.height).toBe('20px');
    expect(span.style.borderRadius).toBe('4px');
  });
});
