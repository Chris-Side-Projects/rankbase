import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Typed, validated configuration.
 *
 * Uses Zod so we get (a) a single source of truth for env shape, (b) runtime
 * coercion (e.g. string → number for PORT), and (c) a clean error message
 * listing every missing/invalid key at startup rather than a cryptic runtime
 * failure deep inside a request handler.
 *
 * In production (NODE_ENV=production) we throw if any required secret is
 * missing. In dev/test we warn and default to empty strings so the server
 * can still boot for health checks, tests that don't touch external services,
 * etc.
 */

const NodeEnv = z.enum(['development', 'test', 'production']);

const baseSchema = z.object({
  NODE_ENV: NodeEnv.default('development'),

  // Server. PORT=0 means "any available" — useful for tests.
  PORT: z.coerce.number().int().nonnegative().default(3000),
  BODY_LIMIT: z.string().default('100kb'),

  // express `trust proxy` setting. Number of hops (1 = nginx on same box,
  // 2 = Cloudflare + nginx) or a keyword ('loopback', 'linklocal',
  // 'uniquelocal'). Wrong setting = req.ip is wrong = rate limiting is
  // applied to the proxy IP, not the user. Default 'loopback' is safe for
  // local dev; nginx-only deployments should set TRUST_PROXY=1; Cloudflare
  // deployments should set TRUST_PROXY=2.
  TRUST_PROXY: z.string().default('loopback'),

  // CORS: comma-separated list of allowed origins, or "*" for open, or "" to disable
  CORS_ORIGINS: z.string().default(''),

  // Log level. 'silent' disables logging entirely (used in tests).
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Observability
  SENTRY_DSN: z.string().default(''),

  // Redis (rate limit + BullMQ). Required in production.
  REDIS_URL: z.string().default(''),

  // Postgres direct connection URL (for node-pg-migrate). Required in production.
  DATABASE_URL: z.string().default(''),

  // AI image providers
  STABILITY_KEY: z.string().default(''),
  OPENAI_KEY: z.string().default(''),
  GOOGLE_API_KEY: z.string().default(''),
  FAL_KEY: z.string().default(''),
  REPLICATE_TOKEN: z.string().default(''),

  // Supabase (for app-layer DB access)
  SUPABASE_URL: z.string().default(''),
  SUPABASE_KEY: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),

  // Cloudflare
  CLOUDFLARE_ACCOUNT_ID: z.string().default(''),
  CLOUDFLARE_IMAGES_TOKEN: z.string().default(''),
  TURNSTILE_SITE_KEY: z.string().default(''),
  TURNSTILE_SECRET: z.string().default(''),

  // Cloudflare R2 (image storage backend)
  R2_ENDPOINT: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET: z.string().default('xcap-data'),
  R2_PUBLIC_URL: z.string().default(''),

  // Auth
  CRON_SECRET: z.string().default(''),

  // External request timeouts (ms)
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  CLOUDFLARE_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  TURNSTILE_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
});

export type Config = z.infer<typeof baseSchema> & { IS_PRODUCTION: boolean; IS_TEST: boolean };

const parsed = baseSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // We throw here because a config parse failure is not recoverable.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === 'production';
const isTest = raw.NODE_ENV === 'test';

// Keys that MUST be set in production. In dev/test we tolerate their absence
// so the server can still boot and tests can run without real credentials.
// At least one image provider is required; individual keys are optional.
const productionRequired: Array<keyof typeof raw> = [
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'CLOUDFLARE_ACCOUNT_ID',
  // TURNSTILE_SITE_KEY and TURNSTILE_SECRET intentionally omitted —
  // Turnstile is optional; when blank, validateTurnstile middleware skips.
  'CRON_SECRET',
  'REDIS_URL',
  'DATABASE_URL',
];

if (isProduction) {
  const missing = productionRequired.filter((k) => !raw[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required production env vars: ${missing.join(', ')}.\n` +
        'Copy .env.example to .env and set every value before deploying.'
    );
  }
  // Require at least one image provider
  const hasProvider =
    raw.STABILITY_KEY || raw.OPENAI_KEY || raw.GOOGLE_API_KEY || raw.FAL_KEY || raw.REPLICATE_TOKEN;
  if (!hasProvider) {
    throw new Error(
      'At least one image provider key is required (FAL_KEY, STABILITY_KEY, OPENAI_KEY, REPLICATE_TOKEN, or GOOGLE_API_KEY).'
    );
  }
  // Cloudflare Images is optional — images can be stored via URL without CF Images
}

export const config: Config = {
  ...raw,
  IS_PRODUCTION: isProduction,
  IS_TEST: isTest,
};
