import { initSentry } from '@rankbase/core/lib/sentry';
initSentry();

import { setSiteConfig, IMGRANK_TABLES } from '@rankbase/core/siteConfig';
setSiteConfig({
  name: 'imgrank',
  siteUrl: 'https://imgrank.app',
  tables: IMGRANK_TABLES,
  requireAuth: false,
  nsfw: false,
  peerSites: ['https://aega.art'],
});

import app from '@rankbase/core/app';
import { config } from '@rankbase/core/config';
import { logger } from '@rankbase/core/lib/logger';
import { setupGracefulShutdown } from '@rankbase/core/lib/shutdown';
import { closeRedis } from '@rankbase/core/lib/redis';
import { closeQueues } from '@rankbase/core/lib/queue';
import { registerImageGeneration } from '@rankbase/core/services/imageGenerationRegistry';
import { generateOneImage } from './services/imageGeneration';

registerImageGeneration({ generateOneImage });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, `imgrank listening on :${config.PORT}`);
});

setupGracefulShutdown(server, [closeQueues, closeRedis]);
