// Sentry must init before any other code
import { initSentry } from '@rankbase/core/lib/sentry';
initSentry();

import app from '@rankbase/core/app';
import { config } from '@rankbase/core/config';
import { logger } from '@rankbase/core/lib/logger';
import { setupGracefulShutdown } from '@rankbase/core/lib/shutdown';
import { closeRedis } from '@rankbase/core/lib/redis';
import { closeQueues } from '@rankbase/core/lib/queue';
import { registerImageGeneration } from '@rankbase/core/services/imageGenerationRegistry';
import { generateOneImage } from './services/imageGeneration';

// Register this app's image generation implementation
registerImageGeneration({ generateOneImage });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, `imgrank listening on :${config.PORT}`);
});

setupGracefulShutdown(server, [closeQueues, closeRedis]);
