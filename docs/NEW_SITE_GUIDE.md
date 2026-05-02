# Adding a New Site

This guide walks through adding a new ranking site to the monorepo from scratch.

A new site takes ~30 minutes to scaffold, assuming you have:
- A domain configured in Cloudflare
- A Supabase project (can reuse the existing one)
- At least one image generation API key

---

## Step 1 — Run the Scaffold Script

```bash
bash tools/new-site.sh <name> <domain> <port> [--nsfw] [--require-auth]

# Example: a safe-for-work video ranking site on port 3043
bash tools/new-site.sh vidrank vidrank.app 3043

# Example: an auth-gated NSFW art ranking site on port 3044
bash tools/new-site.sh artrank artrank.io 3044 --nsfw --require-auth
```

This creates the full directory structure under `apps/<name>/`.

---

## Step 2 — Create Supabase Tables

Edit `tools/templates/new-site.sql` — replace `SITE_PREFIX` with your site name (e.g. `vidrank`).

Run the migration in the Supabase SQL editor, or via CLI:
```bash
cd apps/<name> && npm run db:migrate:up
```

The template creates:
- `<prefix>_images` — main images table with ELO, tags, provider
- `<prefix>_votes` — vote records with user_id, winner, ELO deltas
- `<prefix>_image_reports` — user reports
- `<prefix>_prompts` — prompt pool for generation
- `cast_vote` RPC — atomic ELO update stored procedure
- Indexes and RLS policies

---

## Step 3 — Add Table Constants to siteConfig.ts

In `packages/core/src/siteConfig.ts`, add:

```ts
export const VIDRANK_TABLES: DbTables = {
  images: 'vidrank_images',
  votes: 'vidrank_votes',
  reports: 'vidrank_image_reports',
  prompts: 'vidrank_prompts',
  hourlyImages: 'vidrank_hourly_images',
  tagScoresView: 'vidrank_tag_scores',
};
```

---

## Step 4 — Fill in .env

Edit `apps/<name>/.env`. Copy from `apps/aega-art/.env.example`.

Required:
- `PORT=<your port>` (must match scaffold)
- `SUPABASE_URL`, `SUPABASE_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `R2_*` for image storage
- `CLOUDFLARE_ACCOUNT_ID`
- `CRON_SECRET`

Optional:
- `SENTRY_DSN`
- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`
- Image provider keys (at least one required in production)

---

## Step 5 — Implement Image Generation

Create `apps/<name>/src/services/imageGeneration.ts`:

```ts
import type { GenerateOneImageFn } from '@rankbase/core/services/imageGenerationInterface';

export const generateOneImage: GenerateOneImageFn = async ({ correlationId }) => {
  // Call your image provider here
  // Return { url, provider, prompt, width, height }
};
```

You can use the existing providers from `packages/core/src/services/` as helpers, or write your own.

---

## Step 6 — Update siteConfig in index.ts

Edit `apps/<name>/src/index.ts` (created by scaffold):

```ts
import { setSiteConfig, VIDRANK_TABLES } from '@rankbase/core/siteConfig';

setSiteConfig({
  name: 'vidrank.app',
  siteUrl: 'https://vidrank.app',
  tables: VIDRANK_TABLES,
  requireAuth: false,
  nsfw: false,
  peerSites: ['https://aega.art', 'https://imgrank.app'],
});
```

---

## Step 7 — Update Client Branding

Edit `apps/<name>/client/platform.config.ts`:

```ts
export const platformConfig: PlatformConfig = {
  siteName: 'vidrank.app',
  logoLetter: 'V',
  siteUrl: 'https://vidrank.app',
  requireAuth: false,
  nsfw: false,
  peerSites: ['https://aega.art', 'https://imgrank.app'],
};
```

Replace `apps/<name>/client/public/favicon.svg` with your site's icon.

---

## Step 8 — Wire the Build

In root `package.json`, add:

```json
"build:<name>": "pnpm --filter @rankbase/<name> build && pnpm --filter @rankbase/<name>-client build"
```

---

## Step 9 — Add PM2 Entries

In `ecosystem.config.js`, add two entries:

```js
{
  name: '<name>',
  script: './dist/index.js',
  cwd: '/root/projects/rankbase/apps/<name>',
  instances: 1,
  autorestart: true,
  max_memory_restart: '384M',
  exp_backoff_restart_delay: 100,
  kill_timeout: 10000,
  merge_logs: true,
  time: true,
},
{
  name: '<name>-worker',
  script: './dist/bin/worker.js',
  cwd: '/root/projects/rankbase/apps/<name>',
  instances: 1,
  autorestart: true,
  max_memory_restart: '384M',
  exp_backoff_restart_delay: 100,
  kill_timeout: 30000,
  merge_logs: true,
  time: true,
},
```

---

## Step 10 — Supabase Auth Config

In Supabase dashboard → Authentication → URL Configuration:
- Add `https://<domain>/auth/callback` to Redirect URLs

---

## Step 11 — Cloudflare Tunnel

Add an ingress rule to the CF tunnel pointing `<domain>` → `localhost:<port>`.

---

## Step 12 — Build and Start

```bash
cd /root/projects/rankbase

pnpm build:<name>

pm2 start ecosystem.config.js --only <name> --only <name>-worker
pm2 save

# Smoke test
curl http://127.0.0.1:<port>/api/health
```

---

## Step 13 — Update peerSites Everywhere

Add the new site's URL to `peerSites` in all existing apps' `src/index.ts` and `client/platform.config.ts`, then rebuild + restart them so SSO relay includes the new site.

---

## Checklist

```
[ ] bash tools/new-site.sh <name> <domain> <port>
[ ] Created Supabase tables (new-site.sql)
[ ] Added VIDRANK_TABLES constant to packages/core/src/siteConfig.ts
[ ] Filled in apps/<name>/.env
[ ] Implemented apps/<name>/src/services/imageGeneration.ts
[ ] Updated apps/<name>/src/index.ts with setSiteConfig
[ ] Updated apps/<name>/client/platform.config.ts branding
[ ] Added build script to root package.json
[ ] Added 2 entries to ecosystem.config.js
[ ] Added redirect URL to Supabase auth config
[ ] Added ingress rule to Cloudflare tunnel
[ ] pnpm build:<name> passes
[ ] pm2 start + curl /api/health = 200
[ ] pm2 save
[ ] Updated peerSites in all existing apps
```
