# Decision Record

Key architectural decisions, why they were made, and what was considered.

---

## D1 — pnpm workspaces over npm/yarn

**Decision:** Use pnpm with workspace protocol for the monorepo.

**Why:** pnpm symlinks `@rankbase/core` into `apps/*/node_modules/@rankbase/core` automatically. Combined with the `exports` map in `packages/core/package.json`, subpath imports (`@rankbase/core/lib/sentry`) resolve correctly at runtime without any bundler magic.

**Considered:** yarn workspaces (heavier), lerna (overkill), nx (overkill for 2 sites).

---

## D2 — `setSiteConfig()` at startup, not env vars

**Decision:** Site identity is set via `setSiteConfig()` in code, not via env vars.

**Why:** Env vars can only be strings. `siteConfig` carries typed objects (the full `DbTables` map, arrays like `peerSites`, booleans like `requireAuth`). More importantly, it's explicit — reading the app's `index.ts` tells you exactly what site this is and what tables it uses, with no ambient env var magic.

**Alternative:** Could have used `SITE_NAME=aega-art` env var and a map of configs. Rejected because it hides the config in a lookup table; adding a new site would require editing core.

---

## D3 — Shared Supabase project, separate tables per site

**Decision:** Both aega.art and imgrank.app use the same Supabase project but different table prefixes (`aega_*` vs `imgrank_*`).

**Why:** Simpler ops — one set of credentials, one dashboard, shared auth users (enabling SSO relay). The `siteConfig.tables` abstraction means routes never hardcode table names.

**Tradeoff:** RLS policies need to be duplicated per table. Supabase free tier row limits are shared. For a large-scale deployment, separate projects per site would be better.

---

## D4 — SSO relay via hidden iframe

**Decision:** Cross-domain session sync uses a hidden `<iframe>` loading `/auth/relay#access_token=...`.

**Why:** There's no cross-origin localStorage access. The relay page on the peer site calls `supabase.auth.setSession()` using the token passed in the URL hash (not query string, so it doesn't appear in server logs). The iframe fires-and-forgets; we don't wait for confirmation.

**Security note:** The relay only fires on `SIGNED_IN` events, tokens are passed in the hash fragment (never sent to the server), and the relay page has no UI. Origin trust is handled by Supabase's own JWT validation.

---

## D5 — `detectSessionInUrl: false` + manual PKCE exchange

**Decision:** Supabase JS client is initialized with `detectSessionInUrl: false`. `AuthCallback.tsx` manually calls `exchangeCodeForSession(code)` for PKCE and `setSession({access_token, refresh_token})` for implicit flow.

**Why:** With `detectSessionInUrl: true`, the Supabase SDK tries to exchange the code on every page that loads with `?code=` in the URL, including React's initial render before the router has mounted. This causes a race condition where the exchange fires twice (once from the SDK, once from `AuthCallback`), resulting in "invalid auth code" errors.

**Manual flow:** `AuthCallback` mounts → reads `?code=` param OR `#access_token=` hash → calls the appropriate method → redirects to destination. Clean, predictable, no race.

---

## D6 — `tsc-alias` for path rewriting at build time

**Decision:** Use `tsc-alias` in the build pipeline (`tsc && tsc-alias`) to rewrite `@rankbase/core/*` imports in compiled output.

**Why:** TypeScript path aliases (`@rankbase/core/*` → `../../packages/core/dist/*`) are compile-time only — tsc doesn't rewrite them in the output. At runtime, Node needs real paths. `tsc-alias` post-processes the compiled JS to replace aliases with relative paths.

**Alternative considered:** `tsconfig-paths` at runtime (`node -r tsconfig-paths/register`). Rejected because it adds startup overhead and requires the tsconfig to be present at runtime. Build-time rewriting is cleaner.

**Note:** The `packages/core/package.json` `exports` map is also needed so that `@rankbase/core/lib/sentry` (a subpath import) resolves to `packages/core/dist/lib/sentry.js` via the pnpm symlink, not `packages/core/lib/sentry.js` (which doesn't exist — source is in `src/`).

---

## D7 — PM2 `cwd` set to each app directory

**Decision:** `ecosystem.config.js` sets `cwd` to `apps/<name>/` (not the monorepo root) for each process.

**Why:** dotenvx (used by the project) loads `.env` relative to the process working directory. With `cwd` at the monorepo root, it loads the wrong `.env` (or nothing). With `cwd` at the app directory, it finds `.env` correctly.

**Side effect:** Scripts in `ecosystem.config.js` use `./dist/index.js` (relative to app cwd).

---

## D8 — `.env` symlinked from standalone repos

**Decision:** `apps/aega-art/.env` is a symlink to `/root/projects/aega-art/.env`.

**Why:** The standalone repos still exist and are the source of truth for secrets during the transition. Rather than duplicating secrets files (risk of drift), symlinks keep a single source.

**Future:** Once standalones are retired, convert to real `.env` files.

---

## D9 — `requireAuth` vs `optionalAuth` middleware

**Decision:** Two separate middleware rather than one with a flag.

**Why:** `requireAuth` always returns 401 with no side effects if auth fails. `optionalAuth` always calls `next()` — it just conditionally sets `req.userId`. Having them as separate functions makes the intent at the route level explicit:

```ts
router.post('/vote', requireAuth, ...)    // aega: must be logged in
router.post('/vote', optionalAuth, ...)   // imgrank: logged in = gets credit, anon = fine
```

---

## D10 — fal.ai removed from image generation rotation

**Decision:** Removed fal.ai as an image generation provider permanently.

**Why:** fal.ai blurs NSFW content at the model level regardless of `enable_safety_checker: false`. The blurring is applied server-side before the image is returned. No API flag overrides it. For aega.art (NSFW platform), this makes fal.ai unusable.

**Current providers:** Civitai (20 NSFW-verified models), getimg.ai (Seedream model).
