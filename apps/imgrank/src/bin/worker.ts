import { setSiteConfig, IMGRANK_TABLES } from '@rankbase/core/siteConfig';
setSiteConfig({
  name: 'imgrank.app',
  siteUrl: 'https://imgrank.app',
  tables: IMGRANK_TABLES,
  requireAuth: false,
  nsfw: false,
  peerSites: ['https://aega.art'],
});

import { initSentry } from '@rankbase/core/lib/sentry';
initSentry();

import type { Job } from 'bullmq';
import { startWorkers, closeQueues } from '@rankbase/core/lib/queue';
import { logger } from '@rankbase/core/lib/logger';
import { closeRedis } from '@rankbase/core/lib/redis';
import { config } from '@rankbase/core/config';
import { aggregateTagScores } from '@rankbase/core/services/tagAggregation';
import { generateOneImage } from '../services/imageGeneration';

if (!config.REDIS_URL) {
  logger.fatal('REDIS_URL is required to run the worker');
  process.exit(1);
}

logger.info('starting imgrank worker');

startWorkers({
  onGenerate: async (job: Job) => {
    return generateOneImage({ correlationId: String(job.id ?? '') });
  },
  onAggregateTags: async () => {
    return aggregateTagScores();
  },
});

const shutdown = async (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'worker received shutdown signal');
  await closeQueues();
  await closeRedis();
  process.exit(0);
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

process.on('unhandledRejection', (reason) =>
  logger.fatal({ err: reason }, 'worker unhandledRejection')
);
process.on('uncaughtException', (err) => logger.fatal({ err }, 'worker uncaughtException'));
