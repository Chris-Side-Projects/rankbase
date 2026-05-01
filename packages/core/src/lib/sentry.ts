import * as Sentry from '@sentry/node';
import { config } from '../config';
import { logger } from './logger';

/**
 * Optional Sentry integration for error tracking.
 *
 * Enabled only when SENTRY_DSN is set. In that case Sentry auto-captures
 * uncaught exceptions, unhandled promise rejections, and anything we
 * explicitly pass to `Sentry.captureException`. The `errorHandler`
 * middleware calls this for every 5xx.
 *
 * Note: @sentry/node ^10 auto-instruments HTTP + Express when Sentry.init
 * runs before any HTTP code. `index.ts` imports this module first for
 * exactly that reason.
 */
export function initSentry(): void {
  if (!config.SENTRY_DSN) {
    logger.debug('Sentry DSN not configured, skipping init');
    return;
  }

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.IS_PRODUCTION ? 0.1 : 1.0,
    // Auto-capture unhandledRejection / uncaughtException
    integrations: [],
  });

  logger.info('Sentry initialized');
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!config.SENTRY_DSN) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
