import { ApiError } from '../api/client';
import styles from './ErrorState.module.css';

/**
 * Consistent error UI with a Retry button. If the error is a rate-limit
 * (429) we render the server's Retry-After so the user sees a useful hint
 * rather than a generic 'try again'.
 */
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  const isRateLimit = error instanceof ApiError && error.status === 429;
  const retryAfter = error instanceof ApiError ? error.retryAfter : undefined;

  return (
    <div role="alert" className={styles.root}>
      <h2 className={styles.title}>{isRateLimit ? 'Slow down' : 'Something went wrong'}</h2>
      <p className={styles.message}>{error.message}</p>
      {isRateLimit && retryAfter && (
        <p className={styles.hint}>Try again in {retryAfter}s.</p>
      )}
      {retry && (
        <button type="button" className={styles.button} onClick={retry}>
          Retry
        </button>
      )}
      {error instanceof ApiError && error.requestId && (
        <p className={styles.requestId}>
          Request ID: <code>{error.requestId}</code>
        </p>
      )}
    </div>
  );
}
