import type { Server } from 'http';
import { logger } from './logger';

/**
 * Graceful shutdown handler.
 *
 * Why this exists: when PM2/systemd/kubernetes sends SIGTERM, the default Node
 * behavior is to rip the process down mid-request. That can leave:
 *   - TCP connections hanging until the client times out
 *   - Vote rows inserted without the matching ELO update
 *   - Job-queue entries neither marked done nor returned to the queue
 *
 * The fix:
 *   1. Stop accepting new connections (server.close stops the listener).
 *   2. Let in-flight requests finish (server.close callback fires when the
 *      last active connection closes).
 *   3. Close downstream clients (Redis, Postgres, BullMQ queue) so they flush
 *      pending work and release sockets cleanly.
 *   4. If any of that hasn't completed within `hardTimeoutMs`, force exit —
 *      we'd rather kill a stuck process than block the orchestrator forever.
 */

type Closer = () => Promise<void> | void;

export function setupGracefulShutdown(
  server: Server,
  closers: Closer[] = [],
  hardTimeoutMs = 15_000
): void {
  let shuttingDown = false;

  const onSignal = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'received shutdown signal, draining...');

    const hard = setTimeout(() => {
      logger.fatal('graceful shutdown took too long, forcing exit');
      process.exit(1);
    }, hardTimeoutMs);
    hard.unref();

    try {
      // Stop accepting new connections and wait for in-flight ones to finish.
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('http server closed');

      // Close downstream clients in parallel.
      await Promise.allSettled(closers.map(async (c) => c()));
      logger.info('downstream clients closed');

      clearTimeout(hard);
      process.exit(0);
    } catch (err) {
      logger.fatal({ err }, 'error during shutdown');
      clearTimeout(hard);
      process.exit(1);
    }
  };

  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
}
