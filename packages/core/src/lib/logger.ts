import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from '../config';

/**
 * Structured logging with Pino.
 *
 * Why Pino: it's the fastest JSON logger in the Node ecosystem. In production
 * we emit newline-delimited JSON to stdout so a log collector (Vector,
 * Loki, Datadog agent, etc.) can parse fields directly. In dev we pipe
 * through pino-pretty for a human-friendly colored output.
 *
 * Every log line that comes out of httpLogger carries `req.id` as a `reqId`
 * field so you can grep a single request's full journey.
 */

const baseOptions: pino.LoggerOptions = {
  level: config.LOG_LEVEL,
  base: { service: 'aega-art', env: config.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Keep secrets from accidentally landing in logs. These keys are redacted
  // from any object we log; we use `censor` to avoid even showing lengths.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.STABILITY_KEY',
      '*.OPENAI_KEY',
      '*.GOOGLE_API_KEY',
      '*.SUPABASE_KEY',
      '*.CLOUDFLARE_IMAGES_TOKEN',
      '*.TURNSTILE_SECRET',
      '*.CRON_SECRET',
    ],
    censor: '[REDACTED]',
  },
};

export const logger = pino(
  config.IS_PRODUCTION || config.IS_TEST
    ? baseOptions
    : {
        ...baseOptions,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, singleLine: false, translateTime: 'SYS:HH:MM:ss' },
        },
      }
);

/**
 * Express middleware that logs each request/response pair. Uses the `req.id`
 * set by the requestId middleware as the correlation key.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as unknown as { id?: string }).id ?? '',
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Quiet mode during tests to avoid spamming test output
  autoLogging: !config.IS_TEST,
  customProps: (req) => ({ reqId: (req as unknown as { id?: string }).id }),
});
