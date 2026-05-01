# rankbase

Monorepo for AI image ranking platforms.

## Structure

```
packages/
  core/     — shared Express backend (routes, middleware, services, lib)
  ui/       — shared React SPA (components, pages, hooks, context)
apps/
  aega-art/ — aega.art (NSFW, auth-gated voting)
  imgrank/  — imgrank (SFW, anonymous voting)
```

## Build

```bash
pnpm install
pnpm build          # builds everything in order
pnpm build:aega     # server + client for aega-art only
pnpm build:imgrank  # server + client for imgrank only
```

## Platform config

Each app provides `client/platform.config.ts`:
```ts
export const platformConfig: PlatformConfig = {
  siteName: 'aega.art',
  logoLetter: 'A',
  siteUrl: 'https://aega.art',
  requireAuth: true,   // gate voting behind login
  nsfw: true,
};
```

Vite injects this at build time — shared UI reads it for branding + auth gating.

## Auth

- `packages/core/src/middleware/requireAuth.ts` — hard JWT gate (aega.art)
- `packages/core/src/middleware/optionalAuth.ts` — soft gate, logs userId if present (imgrank)
- `packages/ui/src/context/AuthContext.tsx` — React auth context
- `packages/ui/src/pages/Login.tsx` — magic link + Google OAuth
- `packages/ui/src/pages/AuthCallback.tsx` — OAuth landing, redirects to destination

## Tag generation

```bash
# From apps/aega-art:
OPENROUTER_API_KEY=sk-or-... pnpm tag-images

# From apps/imgrank:
OPENROUTER_API_KEY=sk-or-... pnpm tag-images
```

Script lives in `packages/core/src/scripts/tag-images.ts`.
Reads `IMAGE_TABLE` and `NSFW` env vars — each app's npm script sets them.
