/**
 * PM2 ecosystem config for the rankbase monorepo.
 *
 * Each site runs two processes:
 *   - <site>     HTTP server (Express)
 *   - <site>-worker  BullMQ worker for image generation + tag aggregation
 *
 * Adding a new site: copy the two blocks below, update name, script, cwd, env_file.
 */
module.exports = {
  apps: [
    // ─── aega.art ─────────────────────────────────────────────────────────
    {
      name: 'aega-art',
      script: './dist/index.js',
      cwd: '/root/projects/rankbase/apps/aega-art',
      instances: 1,
      autorestart: true,
      max_memory_restart: '384M',
      exp_backoff_restart_delay: 100,
      kill_timeout: 10000,
      wait_ready: false,
      merge_logs: true,
      time: true,
    },
    {
      name: 'aega-art-worker',
      script: './dist/bin/worker.js',
      cwd: '/root/projects/rankbase/apps/aega-art',
      instances: 1,
      autorestart: true,
      max_memory_restart: '384M',
      exp_backoff_restart_delay: 100,
      kill_timeout: 30000,
      merge_logs: true,
      time: true,
    },

    // ─── imgrank.app ───────────────────────────────────────────────────────
    {
      name: 'imgrank',
      script: './dist/index.js',
      cwd: '/root/projects/rankbase/apps/imgrank',
      instances: 1,
      autorestart: true,
      max_memory_restart: '384M',
      exp_backoff_restart_delay: 100,
      kill_timeout: 10000,
      wait_ready: false,
      merge_logs: true,
      time: true,
    },
    {
      name: 'imgrank-worker',
      script: './dist/bin/worker.js',
      cwd: '/root/projects/rankbase/apps/imgrank',
      instances: 1,
      autorestart: true,
      max_memory_restart: '384M',
      exp_backoff_restart_delay: 100,
      kill_timeout: 30000,
      merge_logs: true,
      time: true,
    },
  ],
};
