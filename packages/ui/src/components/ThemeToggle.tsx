import { useTheme } from '../hooks/useTheme';
import styles from './ThemeToggle.module.css';

/**
 * Accessible theme toggle button. The label changes with state so screen
 * readers announce the action, not just a generic icon name.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={styles.button}
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <span aria-hidden="true" className={styles.icon}>
        {theme === 'dark' ? '☀' : '☾'}
      </span>
    </button>
  );
}
