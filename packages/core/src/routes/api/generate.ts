import { Router } from 'express';
import generate from '../generate';

/**
 * POST /api/generate — same handler as /generate, served under the JSON API
 * path. The generate handler already returns JSON, so we just re-export.
 *
 * (In Phase 2b this becomes a 202-and-enqueue endpoint backed by BullMQ.)
 */
const router: ReturnType<typeof Router> = Router();
router.use('/', generate);
export default router;
