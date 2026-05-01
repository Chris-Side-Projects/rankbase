import styles from './Skeleton.module.css';

/**
 * Loading shimmer used by every data-bound page. A consistent placeholder
 * shape (rather than a spinner) signals layout stability and reduces
 * perceived latency.
 */
export function Skeleton({
  width = '100%',
  height = '1em',
  radius = 'var(--radius-sm)',
}: {
  width?: string;
  height?: string;
  radius?: string;
}) {
  return <span className={styles.shimmer} style={{ width, height, borderRadius: radius }} />;
}
