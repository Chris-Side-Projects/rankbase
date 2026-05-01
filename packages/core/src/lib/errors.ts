/**
 * Typed application errors.
 *
 * Every error thrown by a route or service should extend AppError. The global
 * error handler uses the `status` + `code` fields to render a consistent JSON
 * shape and to decide what to log at what severity.
 *
 * Keeping this taxonomy small on purpose — in practice you only need a handful
 * of shapes (bad input, not found, duplicate, unauthorized, upstream failure,
 * rate limited). Adding more just increases the cognitive load when writing
 * handlers.
 */

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'PROVIDERS_EXHAUSTED'
  | 'INTERNAL';

export class AppError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly expose: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(opts: {
    status: number;
    code: ErrorCode;
    message: string;
    expose?: boolean;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.status = opts.status;
    this.code = opts.code;
    // expose=true → message is safe to send to the client.
    // expose=false → we return a generic message, log the real one internally.
    this.expose = opts.expose ?? opts.status < 500;
    this.details = opts.details;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ status: 400, code: 'BAD_REQUEST', message, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super({ status: 401, code: 'UNAUTHORIZED', message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super({ status: 403, code: 'FORBIDDEN', message });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super({ status: 404, code: 'NOT_FOUND', message });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super({ status: 409, code: 'CONFLICT', message });
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests', retryAfterSeconds?: number) {
    super({
      status: 429,
      code: 'RATE_LIMITED',
      message,
      details: retryAfterSeconds !== undefined ? { retryAfter: retryAfterSeconds } : undefined,
    });
  }
}

export class UpstreamError extends AppError {
  constructor(service: string, cause?: unknown) {
    super({
      status: 502,
      code: 'UPSTREAM_UNAVAILABLE',
      message: `Upstream service unavailable: ${service}`,
      expose: true,
      details: { service },
      cause,
    });
  }
}

export class ProvidersExhaustedError extends AppError {
  constructor() {
    super({
      status: 503,
      code: 'PROVIDERS_EXHAUSTED',
      message: 'All image providers exhausted',
      expose: true,
    });
  }
}

/**
 * Thrown by provider clients when a single provider is rate-limited or out
 * of quota. The generate flow catches this to try the next provider.
 * Not extended from AppError because it's an internal control-flow signal,
 * not something that should ever reach the HTTP layer directly.
 */
export class ProviderExhaustedError extends Error {
  public readonly statusCode: number;
  public readonly provider: string;

  constructor(provider: string, statusCode: number, message?: string) {
    super(message ?? `${provider} exhausted (HTTP ${statusCode})`);
    this.name = 'ProviderExhaustedError';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

/**
 * Convenience factory for the most common 5xx pattern: an internal failure
 * we don't want to surface to clients. The message is logged but the client
 * sees only "Internal server error" via AppError.expose=false.
 *
 * Use this instead of repeating
 *   throw new AppError({ status: 500, code: 'INTERNAL', message, expose: false })
 * which is duplicated across many handlers today.
 */
export function internalError(message: string, cause?: unknown): AppError {
  return new AppError({
    status: 500,
    code: 'INTERNAL',
    message,
    expose: false,
    cause,
  });
}
