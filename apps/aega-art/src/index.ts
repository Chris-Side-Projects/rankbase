// Sentry must init before any other code
import { initSentry } from '@rankbase/core/lib/sentry';
initSentry();

// Set site config BEFORE importing app — routes read this at request time
import { setSiteConfig, AEGA_TABLES } from '@rankbase/core/siteConfig';
setSiteConfig({
  name: 'aega.art',
  siteUrl: 'https://aega.art',
  tables: AEGA_TABLES,
  requireAuth: true,
  nsfw: true,
  peerSites: ['https://imgrank.app'],
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
  logger.info({ port: config.PORT, env: config.NODE_ENV }, `aega-art listening on :${config.PORT}`);
});

setupGracefulShutdown(server, [closeQueues, closeRedis]);
