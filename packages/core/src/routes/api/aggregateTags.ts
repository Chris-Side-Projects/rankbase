import { Router } from 'express';
import aggregateTags from '../aggregateTags';

/**
 * POST /api/aggregate-tags — JSON variant, same handler as the legacy route.
 */
const router: ReturnType<typeof Router> = Router();
router.use('/', aggregateTags);
export default router;
