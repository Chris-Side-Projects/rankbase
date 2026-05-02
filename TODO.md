# TODO

Tracked work for the rankbase monorepo.
Format: `[ ]` = open, `[x]` = done, `[~]` = in progress, `[-]` = blocked

---

## Infrastructure

- [x] Monorepo structure with pnpm workspaces
- [x] `packages/core` — shared Express backend
- [x] `packages/ui` — shared React SPA
- [x] `apps/aega-art` migrated from standalone
- [x] `apps/imgrank` migrated from standalone
- [x] Worker entry points per app (`src/bin/worker.ts`)
- [x] PM2 ecosystem config (`ecosystem.config.js`)
- [x] `.env` symlinks from standalone repos
- [x] `packages/core` exports map for subpath imports
- [x] `tsc-alias` for build-time path rewriting
- [x] Both sites live and serving from monorepo
- [-] CI workflow (`.github/workflows/ci.yml`) — blocked: edwardtheclaw PAT lacks `workflow` scope
- [ ] Retire standalone repos (`/root/projects/aega-art`, `/root/projects/imgrank`) once confident

## Features

- [x] Google OAuth + magic link auth
- [x] PKCE OAuth flow with manual code exchange
- [x] SSO relay — login to one site, auto-login to all peers
- [x] Vote history page (`/history`) — shows last 50 votes with winner/loser images
- [x] `My Votes` nav link (auth-gated)
- [x] Turnstile widget position fix — now above vote buttons
- [x] CSP fix — Supabase domains added to `connect-src`
- [x] `new-site.sh` scaffolding script
- [ ] Per-site theme customization (colors, fonts via CSS variables in `platform.config.ts`)
- [ ] Site-specific homepage (non-compare landing page for marketing)
- [ ] User profile page (`/profile`) — stats, ELO, vote count
- [ ] Pagination on vote history (currently last 50)
- [ ] Admin dashboard improvements — bulk hide, moderation queue

## Image Generation

- [x] Civitai provider (20 NSFW models)
- [x] getimg.ai provider (Seedream)
- [x] fal.ai removed (blurs NSFW despite flag)
- [x] 60-image hourly gen loop
- [ ] Provider health dashboard (success rate, latency per provider)
- [ ] Automatic model rotation based on success rate
- [ ] imgrank-specific SFW model pool

## New Sites (ideas)

- [ ] `vidrank.app` — rank AI-generated short videos
- [ ] `artrank.io` — rank specific art styles (portraits, landscapes, etc.)
- [ ] `promptrank.app` — rank prompts, not images (text-based ELO)

## Technical Debt

- [ ] Remove `ignoreDeprecations: "6.0"` once TS 6 path handling stabilized
- [ ] Replace symlinked `.env` with proper secrets manager
- [ ] Move standalone repos to archive once replaced
- [ ] Add `exports` map entries for all new subpaths added to `packages/core`
- [ ] Verify `tsc-alias` rewrites worker binary paths correctly after builds

---

*Last updated: 2026-05-02*
