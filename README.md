# rankbase

Monorepo for AI image ranking platforms. One shared backend + frontend, infinite sites.

## Live Sites

| Site | Domain | Auth | NSFW | Port |
|------|--------|------|------|------|
| aega.art | https://aega.art | Required | Yes | 3042 |
| imgrank.app | https://imgrank.app | Optional | No | 3041 |

## How It Works

Every site in this monorepo shares:
- **`packages/core`** — the entire Express backend (routes, middleware, services, lib)
- **`packages/ui`** — the entire React SPA (pages, components, hooks, context)

A "site" is just an `apps/<name>/` directory that:
1. Calls `setSiteConfig()` at startup to declare its table names, auth requirements, and peer sites
2. Registers its image generation providers
3. Has its own `.env`, branding assets, and PM2 entry

Zero core changes needed to add a new site.

## Structure

```
rankbase/
├── packages/
│   ├── core/               ← shared Express backend
│   │   └── src/
│   │       ├── app.ts      ← Express app factory
│   │       ├── config.ts   ← env var schema (Zod)
│   │       ├── siteConfig.ts ← per-site table names + options
│   │       ├── routes/     ← all API routes
│   │       ├── middleware/ ← auth, rate limit, turnstile, validate
│   │       ├── services/   ← supabase, r2, image gen, analytics
│   │       └── lib/        ← elo, errors, logger, queue, redis, etc.
│   └── ui/                 ← shared React SPA
│       └── src/
│           ├── App.tsx     ← router
│           ├── pages/      ← all pages (Compare, Leaderboard, VoteHistory…)
│           ├── components/ ← Nav, Toast, Skeleton, ReportButton…
│           ├── context/    ← AuthContext (Supabase session)
│           ├── hooks/      ← useApi, useDeviceHash, useSwipe
│           └── api/        ← typed fetch client
├── apps/
│   ├── aega-art/           ← aega.art app
│   │   ├── src/
│   │   │   ├── index.ts    ← calls setSiteConfig, starts server
│   │   │   ├── bin/worker.ts ← BullMQ worker entry
│   │   │   └── services/   ← civitai, getimg, deepseek, replicate
│   │   ├── client/         ← Vite config + platform branding
│   │   ├── migrations/     ← Supabase SQL migrations
│   │   └── .env            ← symlink → /root/projects/aega-art/.env
│   └── imgrank/            ← imgrank.app app (same structure)
├── tools/
│   ├── new-site.sh         ← scaffold a new site from scratch
│   └── templates/          ← SQL migration template for new sites
└── ecosystem.config.js     ← PM2 config for all 4 processes
```

## Quickstart

```bash
pnpm install

# Build everything
pnpm build

# Build one site
pnpm build:aega
pnpm build:imgrank

# Type-check all packages
pnpm typecheck

# Start via PM2 (production)
pm2 start ecosystem.config.js
```

## Adding a New Site

Use the scaffolding script:

```bash
bash tools/new-site.sh <name> <domain> <port> [--nsfw] [--require-auth]

# Examples:
bash tools/new-site.sh vidrank vidrank.app 3043
bash tools/new-site.sh artrank artrank.io 3044 --nsfw --require-auth
```

This creates:
- `apps/<name>/src/index.ts` — siteConfig setup + server start
- `apps/<name>/src/bin/worker.ts` — BullMQ worker
- `apps/<name>/client/platform.config.ts` — branding (name, logo letter, colors)
- `apps/<name>/client/vite.config.ts` — build config
- `apps/<name>/package.json` + `apps/<name>/client/package.json`
- `apps/<name>/.env` — from template, fill in secrets
- `tools/templates/new-site.sql` — Supabase migration template

Then:
1. Fill in `.env` with real credentials
2. Add Supabase tables (run `new-site.sql` migration)
3. Add 2 entries to `ecosystem.config.js`
4. Add `pnpm build:<name>` script to root `package.json`
5. `pnpm build:<name> && pm2 start ecosystem.config.js --only <name> --only <name>-worker`

## Site Config

Each app's `src/index.ts` calls `setSiteConfig()` before anything else:

```ts
import { setSiteConfig, AEGA_TABLES } from '@rankbase/core/siteConfig';

setSiteConfig({
  name: 'aega.art',
  siteUrl: 'https://aega.art',
  tables: AEGA_TABLES,   // or IMGRANK_TABLES, or a custom DbTables object
  requireAuth: true,     // if true, voting requires login
  nsfw: true,            // affects content warnings + moderation
  peerSites: ['https://imgrank.app'],  // SSO relay targets
});
```

## Client Branding

Each app's `client/platform.config.ts`:

```ts
export const platformConfig: PlatformConfig = {
  siteName: 'aega.art',
  logoLetter: 'A',
  siteUrl: 'https://aega.art',
  requireAuth: true,
  nsfw: true,
  peerSites: ['https://imgrank.app'],
};
```

Vite injects this at build time. The shared UI reads it for nav branding, login prompts, and SSO relay.

## Auth

- `requireAuth` middleware — hard JWT gate. Reads `Authorization: Bearer <token>`, verifies with Supabase.
- `optionalAuth` middleware — soft gate. Sets `req.userId` if token present, otherwise continues.
- `AuthContext` — React context. Holds Supabase session, exposes `user`, `signOut`.
- Login page — supports Google OAuth + magic link email.
- `AuthCallback` page — handles PKCE code exchange and implicit flow hash parsing.
- SSO relay — on `SIGNED_IN`, fires hidden iframes to `peerSites` so all sites share the session.

## Image Generation

Image generation is site-specific (different provider pools per site).

Each app registers its generator at startup:

```ts
import { registerImageGeneration } from '@rankbase/core/services/imageGenerationRegistry';
import { generateOneImage } from './services/imageGeneration';

registerImageGeneration({ generateOneImage });
```

The BullMQ worker then calls the registered generator when jobs arrive.

## Database

Each site uses its own Supabase tables. Naming convention:

```
aega_images      → aega-art images
aega_votes       → aega-art votes
imgrank_images   → imgrank images
imgrank_votes    → imgrank votes
```

The `AEGA_TABLES` and `IMGRANK_TABLES` constants in `siteConfig.ts` map these. Add your own constant for new sites.

## PM2 Process Map

| PM2 Name | Script | Purpose |
|----------|--------|---------|
| `aega-art` | `apps/aega-art/dist/index.js` | aega.art HTTP server |
| `aega-art-worker` | `apps/aega-art/dist/bin/worker.js` | aega.art image gen worker |
| `imgrank` | `apps/imgrank/dist/index.js` | imgrank.app HTTP server |
| `imgrank-worker` | `apps/imgrank/dist/bin/worker.js` | imgrank.app image gen worker |

All managed from `ecosystem.config.js` at the repo root.

## Environment Variables

Each app needs a `.env` in its directory. See `apps/aega-art/.env.example` for the full list.

Key variables:
- `SUPABASE_URL`, `SUPABASE_KEY` — Supabase project
- `DATABASE_URL` — direct Postgres connection
- `REDIS_URL` — BullMQ queue backend
- `R2_*` — Cloudflare R2 for image storage
- `CLOUDFLARE_ACCOUNT_ID` — CF Images
- `CRON_SECRET` — auth for cron-triggered endpoints
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth
- `SENTRY_DSN` — error tracking (optional)
- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` — bot protection (optional)

## Migrations

SQL migrations live in `apps/<name>/migrations/`. Run via:

```bash
cd apps/aega-art && npm run db:migrate:up
```

Uses `node-pg-migrate`.
