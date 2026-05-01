import { Queue, Worker, QueueEvents, type Job } from 'bullmq';
import { getBullRedis } from './redis';
import { logger } from './logger';
import { config } from '../config';

/**
 * BullMQ-backed job queues for long-running, non-user-facing work.
 *
 * Why a job queue: today /generate does provider calls + image upload + DB
 * write on the hot request path. A single generate can take 10–30 seconds;
 * a slow one can overrun the nginx 60s proxy timeout and leave the cron
 * curl hanging. Pushing to a queue makes the HTTP handler return instantly
 * (202 Accepted) and lets a separate worker process pick up and retry on
 * failure.
 *
 * Queues:
 *   - image-generation:   one job per image request; worker runs the
 *                         provider fallback chain, Cloudflare upload, tag
 *                         + DB insert.
 *   - tag-aggregation:    one job per /aggregate-tags call; runs the
 *                         full materialization.
 *
 * Falls back to in-process synchronous execution when REDIS_URL is unset,
 * so local dev and tests don't need Redis running to function.
 */

export const QUEUE_NAMES = {
  imageGeneration: 'image-generation',
  tagAggregation: 'tag-aggregation',
} as const;

let _generationQueue: Queue | null = null;
let _tagQueue: Queue | null = null;
const _workers: Worker[] = [];
const _events: QueueEvents[] = [];

function queueConnection() {
  const conn = getBullRedis();
  if (!conn) throw new Error('BullMQ requires REDIS_URL');
  return conn;
}

export function getGenerationQueue(): Queue | null {
  if (!config.REDIS_URL) return null;
  if (!_generationQueue) {
    _generationQueue = new Queue(QUEUE_NAMES.imageGeneration, {
      connection: queueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86_400 },
      },
    });
  }
  return _generationQueue;
}

export function getTagQueue(): Queue | null {
  if (!config.REDIS_URL) return null;
  if (!_tagQueue) {
    _tagQueue = new Queue(QUEUE_NAMES.tagAggregation, {
      connection: queueConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86_400 },
      },
    });
  }
  return _tagQueue;
}

/**
 * Starts an in-process worker for each queue. In production deploys where
 * the web server and worker are separate processes, this is invoked from
 * `bin/worker.ts` on the worker box. In smaller deployments it can run in
 * the same process as the web server.
 */
export function startWorkers(handlers: {
  onGenerate: (job: Job) => Promise<unknown>;
  onAggregateTags: (job: Job) => Promise<unknown>;
}): void {
  if (!config.REDIS_URL) {
    logger.info('REDIS_URL not set, skipping BullMQ workers');
    return;
  }

  const connection = queueConnection();

  const generationWorker = new Worker(QUEUE_NAMES.imageGeneration, handlers.onGenerate, {
    connection,
    concurrency: 1,
  });
  const tagWorker = new Worker(QUEUE_NAMES.tagAggregation, handlers.onAggregateTags, {
    connection,
    concurrency: 1,
  });

  for (const w of [generationWorker, tagWorker]) {
    w.on('completed', (job) => logger.info({ queue: w.name, jobId: job.id }, 'job completed'));
    w.on('failed', (job, err) =>
      logger.error({ queue: w.name, jobId: job?.id, err }, 'job failed')
    );
  }

  _workers.push(generationWorker, tagWorker);

  for (const qName of Object.values(QUEUE_NAMES)) {
    const events = new QueueEvents(qName, { connection });
    _events.push(events);
  }
}

export async function closeQueues(): Promise<void> {
  await Promise.allSettled([..._workers.map((w) => w.close()), ..._events.map((e) => e.close())]);
  if (_generationQueue) await _generationQueue.close();
  if (_tagQueue) await _tagQueue.close();
  _workers.length = 0;
  _events.length = 0;
  _generationQueue = null;
  _tagQueue = null;
}
