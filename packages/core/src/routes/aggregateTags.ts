import { Router, Request, Response } from 'express';
import { aggregateTagScores } from '../services/tagAggregation';
import { getTagQueue } from '../lib/queue';

const router: ReturnType<typeof Router> = Router();

/**
 * POST /aggregate-tags — rebuilds the tag_scores materialization.
 *
 * Enqueues to BullMQ when Redis is configured so a long-running aggregate
 * doesn't block the HTTP path. Falls back to inline execution otherwise.
 */
router.post('/', async (req: Request, res: Response) => {
  const queue = getTagQueue();
  if (queue) {
    const job = await queue.add('aggregate', { correlationId: req.id });
    res.status(202).json({ jobId: job.id, status: 'queued' });
    return;
  }

  const result = await aggregateTagScores();
  res.json(result);
});

export default router;
