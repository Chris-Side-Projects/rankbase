import CircuitBreaker from 'opossum';
import { logger } from './logger';
import { ProviderExhaustedError } from './errors';

/**
 * Circuit breaker factory for external providers.
 *
 * The pattern: if a remote service fails repeatedly, the breaker "opens" and
 * every call fails fast for a cooldown period instead of waiting for the
 * upstream timeout each time. This both protects the upstream from a pile-on
 * during incidents and protects us from wasting CPU on doomed calls.
 *
 * We treat ProviderExhaustedError as an expected outcome (rate-limit, quota
 * exhausted) — it's part of normal operation and should not count toward
 * opening the breaker. Only network errors and timeouts do.
 *
 * On the two timers: opossum has its own `timeout` (the breaker considers a
 * call "failed" if it exceeds this) and the wrapped function typically uses
 * fetchWithTimeout (which AbortControllers the request). We deliberately
 * keep both: fetchWithTimeout is the primary cancellation path because it
 * actually frees the socket, and opossum's timer is an outer safety net set
 * a few seconds higher so it only fires if the inner abort somehow fails to
 * propagate. Removing either is incorrect — the outer timer alone wouldn't
 * release sockets; the inner timer alone wouldn't feed the breaker's stats.
 */
export function wrapWithBreaker<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: { timeoutMs?: number; errorThreshold?: number; resetMs?: number } = {}
): (...args: TArgs) => Promise<TResult> {
  const breaker = new CircuitBreaker(fn as (...args: unknown[]) => Promise<TResult>, {
    timeout: options.timeoutMs ?? 35_000, // slightly above the fetch timeout
    errorThresholdPercentage: options.errorThreshold ?? 50,
    resetTimeout: options.resetMs ?? 30_000,
    rollingCountTimeout: 60_000,
    rollingCountBuckets: 10,
    name,
    // Don't open on expected domain failures (rate-limit cascade)
    errorFilter: (err: Error) => err instanceof ProviderExhaustedError,
  });

  breaker.on('open', () => logger.warn({ breaker: name }, 'circuit breaker opened'));
  breaker.on('halfOpen', () => logger.info({ breaker: name }, 'circuit breaker half-open'));
  breaker.on('close', () => logger.info({ breaker: name }, 'circuit breaker closed'));
  breaker.on('failure', (err: unknown) =>
    logger.warn({ breaker: name, err }, 'circuit breaker recorded failure')
  );

  return (...args: TArgs) => breaker.fire(...(args as unknown[])) as Promise<TResult>;
}
