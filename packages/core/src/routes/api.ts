import { Router, Request, Response } from 'express';

/**
 * JSON API router mounted at /api/*.
 *
 * This file is the entry point for API routes consumed by the SPA (Phase 4b).
 * Each sub-resource lives in its own file; we wire them up here so route
 * registration stays a single, obvious list.
 */

const router: ReturnType<typeof Router> = Router();

import leaderboardApi from './api/leaderboard';
import tagboardApi from './api/tagboard';
import compareApi from './api/compare';
import voteApi from './api/vote';
import generateApi from './api/generate';
import aggregateTagsApi from './api/aggregateTags';
import adminApi from './api/admin';
import providersApi from './api/providers';
import imagesApi from './api/images';
import tagsApi from './api/tags';
import hourlyApi from './hourly';
import analyticsApi from './analytics';
import promptVoteApi from './api/promptVote';

import { cronAuth } from '../middleware/cronAuth';
import { rateLimitRedis } from '../middleware/rateLimitRedis';

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// /api/ready mirrors /ready so SPA + dashboards can use a consistent
// /api/* path without leaving the JSON API namespace.
import healthRouter from './health';
router.use('/', healthRouter);

router.use('/leaderboard', leaderboardApi);
router.use('/tagboard', tagboardApi);
router.use('/providers', providersApi);
router.use('/images', imagesApi);
router.use('/tags', tagsApi);
router.use('/compare', compareApi);
router.use('/prompts', promptVoteApi);
// Redis-backed rate limit when REDIS_URL is set; in-memory fallback otherwise.
// Falls back gracefully so tests and local dev don't require Redis running.
router.use('/vote', rateLimitRedis(30, 60_000), voteApi);
router.use('/generate', cronAuth, rateLimitRedis(5, 60_000), generateApi);
router.use('/aggregate-tags', cronAuth, aggregateTagsApi);
router.use('/admin', adminApi);
router.use('/hourly', hourlyApi);
router.use('/analytics', analyticsApi);

export default router;
