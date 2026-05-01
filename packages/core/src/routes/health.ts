import { Router, Request, Response } from 'express';
import { getRedis } from '../lib/redis';
import { getSupabase } from '../services/supabase';
import { logger } from '../lib/logger';
import { config } from '../config';

const router: ReturnType<typeof Router> = Router();

/**
 * Liveness vs readiness:
 *   GET /health  — am I up? (cheap; no downstream calls)
 *   GET /ready   — am I ready to serve traffic? (pings Redis + Supabase)
 *
 * Orchestrators should hit /health for "should I restart this pod?" and
 * /ready for "should I include this pod in the load-balancer rotation?".
 * The two are intentionally different so a transient downstream blip
 * doesn't cause a restart loop.
 */

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

interface ProbeResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

async function probe<T>(name: string, fn: () => Promise<T>): Promise<ProbeResult> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    logger.warn({ probe: name, err }, 'readiness probe failed');
    return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
  }
}

router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, ProbeResult> = {};

  // Redis: PING. Skip when Redis isn't configured (dev/test).
  if (config.REDIS_URL) {
    const redis = getRedis();
    checks.redis = await probe('redis', async () => {
      if (!redis) throw new Error('redis client not initialized');
      const reply = await redis.ping();
      if (reply !== 'PONG') throw new Error(`unexpected ping reply: ${reply}`);
    });
  }

  // Supabase: cheap count on images. We don't fetch rows because that'd be
  // expensive; HEAD count is constant-time on indexed tables.
  if (config.SUPABASE_URL && config.SUPABASE_KEY) {
    checks.supabase = await probe('supabase', async () => {
      const supabase = getSupabase();
      const { error } = await supabase.from('aega_images').select('id', { head: true, count: 'exact' });
      if (error) throw new Error(error.message);
    });
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
