import { Router, Request, Response } from 'express';
import { getImageGeneration } from '../services/imageGenerationRegistry';
import { getGenerationQueue } from '../lib/queue';

const router: ReturnType<typeof Router> = Router();

/**
 * POST /generate — creates one new AI-generated image.
 *
 * Uses the app-registered imageGeneration service (injected at startup).
 */
router.post('/', async (_req: Request, res: Response) => {
  const queue = getGenerationQueue();
  if (queue) {
    await queue.add('generate', {});
    res.status(202).json({ queued: true });
    return;
  }
  const svc = getImageGeneration();
  const result = await svc.generateOneImage();
  res.status(201).json(result);
});

export default router;
