import { useEffect } from 'react';
import styles from './Toast.module.css';

/**
 * Transient feedback banner. Auto-dismisses after `timeoutMs` and can also
 * be closed manually. Rendered into aria-live="polite" so assistive tech
 * announces the content without interrupting the user.
 */
export function Toast({
  message,
  kind = 'success',
  timeoutMs = 2500,
  onClose,
}: {
  message: string;
  kind?: 'success' | 'error' | 'info';
  timeoutMs?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onClose, timeoutMs);
    return () => clearTimeout(id);
  }, [onClose, timeoutMs]);

  return (
    <div role="status" aria-live="polite" className={`${styles.toast} ${styles[kind]}`}>
      <span>{message}</span>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
