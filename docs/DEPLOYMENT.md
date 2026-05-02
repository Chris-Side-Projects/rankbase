# Deployment

## Server

All sites run on a single VPS (srv1302736, 72.61.27.166) behind Cloudflare tunnels.

```
Browser → Cloudflare → CF Tunnel (be468464-...) → localhost:<port> → Express app
```

## PM2 Processes

```bash
# Check status
pm2 list

# Restart a site
pm2 restart aega-art
pm2 restart imgrank

# View logs
pm2 logs aega-art --lines 50
pm2 logs imgrank-worker --lines 50

# Restart everything
pm2 restart ecosystem.config.js
```

| PM2 Name | Port | Worker? |
|----------|------|---------|
| `aega-art` | 3042 | No |
| `aega-art-worker` | — | Yes |
| `imgrank` | 3041 | No |
| `imgrank-worker` | — | Yes |

## Deploy a New Build

```bash
cd /root/projects/rankbase

# Full rebuild + restart everything
pnpm build && pm2 restart aega-art aega-art-worker imgrank imgrank-worker

# Rebuild + restart one site only
pnpm build:aega && pm2 restart aega-art aega-art-worker

# After changing ecosystem.config.js: delete + re-add (PM2 caches configs)
pm2 delete aega-art && pm2 start ecosystem.config.js --only aega-art
```

## Environment Files

Each app's `.env` is currently a symlink:
- `apps/aega-art/.env` → `/root/projects/aega-art/.env`
- `apps/imgrank/.env` → `/root/projects/imgrank/.env`

These contain all secrets. Never commit them. Never log them.

Key env vars to check if something breaks:
- `SUPABASE_URL`, `SUPABASE_KEY` — DB access
- `REDIS_URL` — required for workers
- `DATABASE_URL` — required for migrations
- `CRON_SECRET` — required for cron endpoints in production

## Adding a New Site to PM2

Add two entries to `ecosystem.config.js`:

```js
{
  name: 'mysite',
  script: './dist/index.js',
  cwd: '/root/projects/rankbase/apps/mysite',  // IMPORTANT: cwd = app dir
  instances: 1,
  autorestart: true,
  max_memory_restart: '384M',
  exp_backoff_restart_delay: 100,
  kill_timeout: 10000,
  merge_logs: true,
  time: true,
},
{
  name: 'mysite-worker',
  script: './dist/bin/worker.js',
  cwd: '/root/projects/rankbase/apps/mysite',
  instances: 1,
  autorestart: true,
  max_memory_restart: '384M',
  exp_backoff_restart_delay: 100,
  kill_timeout: 30000,
  merge_logs: true,
  time: true,
},
```

⚠️ **`cwd` must be the app directory**, not the monorepo root. dotenvx loads `.env` relative to `cwd`.

Then start:
```bash
pm2 start ecosystem.config.js --only mysite --only mysite-worker
pm2 save
```

## Cloudflare Tunnel

Tunnel ID: `be468464-4c05-4ee9-8ab8-991a0bfa1509`

To add a new site, add an ingress rule pointing the new domain to `localhost:<port>`.

## Supabase Auth Config

For each new site, add to Supabase redirect allow list:
```
https://<domain>/auth/callback
```

Dashboard → Authentication → URL Configuration → Redirect URLs.

## Saving PM2 State

After any changes to running processes:
```bash
pm2 save
```

This updates `/root/.pm2/dump.pm2` so processes restart on server reboot.

## Common Issues

### App crash-loops after deploy
```bash
pm2 logs aega-art --lines 20
# Look for: "Missing required production env vars"
# Fix: delete and re-add the process so PM2 reloads the config
pm2 delete aega-art && pm2 start ecosystem.config.js --only aega-art
```

### Worker loads 0 env vars
```bash
# "injected env (0)" = dotenvx can't find .env
# Cause: PM2 cwd is wrong or stale. Fix same as above.
pm2 delete aega-art-worker && pm2 start ecosystem.config.js --only aega-art-worker
```

### Module not found: @rankbase/core/...
```bash
# Rebuild with path alias rewriting
pnpm --filter @rankbase/aega-art build
# This runs: tsc && tsc-alias
```
