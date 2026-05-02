# Architecture

## Goal

One codebase, many sites. Adding a new AI ranking site should take ~30 minutes, not days.

The core insight: every ranking site is the same app with different:
- Database table names
- Image generation providers
- Auth requirements (gated vs open)
- Branding (name, logo, colors)
- Content policy (NSFW vs SFW)

Everything else — ELO ranking, voting, leaderboard, image tagging, analytics, auth flow — is identical.

---

## Layer Diagram

```
┌──────────────────────────────────────┐
│  Browser (React SPA)                  │
│  packages/ui                          │
│  - shared pages (Compare, Leaderboard,│
│    VoteHistory, Admin, Tags…)         │
│  - shared components (Nav, Toast…)    │
│  - platform.config.ts (branding)      │
└───────────────┬──────────────────────┘
                │  fetch /api/*
┌───────────────▼──────────────────────┐
│  Express server                       │
│  packages/core                        │
│  - all routes (/api/compare, /vote…)  │
│  - middleware (auth, rate limit…)     │
│  - services (supabase, r2, moderation)│
│  - siteConfig (table names, options)  │
└───────────────┬──────────────────────┘
                │
┌───────────────▼──────────────────────┐
│  BullMQ Worker                        │
│  apps/<name>/src/bin/worker.ts        │
│  - image generation jobs              │
│  - tag aggregation jobs               │
│  - site-specific providers            │
└───────────────┬──────────────────────┘
                │
┌───────────────▼──────────────────────┐
│  Supabase (Postgres + Auth)           │
│  Redis (BullMQ queues)                │
│  Cloudflare R2 (image storage)        │
└──────────────────────────────────────┘
```

---

## Site Isolation via `siteConfig`

The server is stateless across sites. At startup, each app calls:

```ts
setSiteConfig({
  name: 'aega.art',
  siteUrl: 'https://aega.art',
  tables: AEGA_TABLES,        // maps logical names → DB table names
  requireAuth: true,
  nsfw: true,
  peerSites: ['https://imgrank.app'],
});
```

Every route then reads `getSiteConfig()` instead of hardcoding table names. So `aega_images` vs `imgrank_images` is resolved at request time — the route code is identical.

### Table Mapping

```ts
// packages/core/src/siteConfig.ts
export const AEGA_TABLES: DbTables = {
  images: 'aega_images',
  votes: 'aega_votes',
  reports: 'aega_image_reports',
  prompts: 'aega_prompts',
  hourlyImages: 'aega_hourly_images',
  tagScoresView: 'aega_tag_scores',
};

export const IMGRANK_TABLES: DbTables = {
  images: 'imgrank_images',
  votes: 'imgrank_votes',
  // ...
};
```

---

## Client Branding via `platform.config.ts`

At build time, each app's `client/platform.config.ts` tells Vite what this site is:

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

The shared `Nav`, `Compare`, and auth flow components all read this. So the same React code renders "aega.art" with auth prompts for aega, and "imgrank" without for imgrank.

---

## Auth Flow

```
User clicks "Sign in with Google"
  → /auth/callback?code=...  (PKCE flow)
  → AuthCallback.tsx calls supabase.auth.exchangeCodeForSession(code)
  → Session stored in Supabase JS SDK (localStorage)
  → AuthContext.onAuthStateChange fires SIGNED_IN
  → SSO relay fires hidden iframes to peerSites:
      <iframe src="https://imgrank.app/auth/relay#access_token=...&refresh_token=...">
  → AuthRelay.tsx on peer site calls supabase.auth.setSession(...)
  → User is now logged in on ALL sites
```

The relay is cross-domain but same-Supabase-project — tokens are valid on all sites.

---

## Image Generation Pipeline

```
Cron hits POST /api/generate (with CRON_SECRET)
  → Enqueues job in Redis via BullMQ
  → Worker picks up job
  → Calls registerImageGeneration().generateOneImage()
      → site-specific: picks provider from rotation
      → calls civitai / getimg.ai / etc.
      → uploads result to R2
      → inserts row into aega_images (or imgrank_images)
      → triggers tag aggregation if needed
```

The worker is a separate PM2 process so a slow generation doesn't block HTTP requests.

---

## Adding a New Site — Checklist

1. **Run scaffold**: `bash tools/new-site.sh <name> <domain> <port> [--nsfw] [--require-auth]`
2. **Create Supabase tables**: run `tools/templates/new-site.sql` (edit table prefix first)
3. **Fill `.env`**: copy from another app, update `PORT` and any site-specific keys
4. **Add image providers**: implement `apps/<name>/src/services/imageGeneration.ts`
5. **Add branding**: edit `apps/<name>/client/platform.config.ts` and `client/public/favicon.svg`
6. **Wire PM2**: add 2 entries to `ecosystem.config.js`
7. **Wire build**: add `build:<name>` script to root `package.json`
8. **Build + start**: `pnpm build:<name> && pm2 start ecosystem.config.js --only <name> --only <name>-worker`
9. **Add Supabase redirect URL**: `https://<domain>/auth/callback` in Supabase dashboard
10. **Add Cloudflare tunnel**: new `ingress` rule in CF tunnel config pointing to `localhost:<port>`

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/siteConfig.ts` | Per-site config interface + table constants |
| `packages/core/src/app.ts` | Express app factory (CSP, middleware, routes) |
| `packages/core/src/config.ts` | Env var schema (Zod) |
| `packages/core/src/routes/api.ts` | API router — wires all sub-routes |
| `packages/core/src/services/imageGenerationRegistry.ts` | Plugin registry for image gen |
| `packages/ui/src/App.tsx` | React router |
| `packages/ui/src/platform.config.ts` | Client-side site config type |
| `packages/ui/src/context/AuthContext.tsx` | Supabase auth state |
| `apps/aega-art/src/index.ts` | aega.art entry point |
| `ecosystem.config.js` | PM2 process config |

---

## Decisions Log

See `docs/DECISIONS.md` for full rationale on key choices.
