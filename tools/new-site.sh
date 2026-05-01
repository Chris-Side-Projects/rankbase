#!/usr/bin/env bash
# new-site.sh — Scaffold a new rankbase site
#
# Usage:
#   bash tools/new-site.sh <name> <domain> <port> [--nsfw] [--require-auth]
#
# Example:
#   bash tools/new-site.sh vidrank vidrank.app 3043
#   bash tools/new-site.sh artrank artrank.io 3044 --nsfw --require-auth
#
# What it does:
#   1. Creates apps/<name>/src/index.ts with setSiteConfig
#   2. Creates apps/<name>/client/platform.config.ts
#   3. Creates apps/<name>/client/vite.config.ts
#   4. Creates apps/<name>/client/package.json
#   5. Creates apps/<name>/package.json
#   6. Creates apps/<name>/.env from template
#   7. Adds the domain to Supabase uri_allow_list
#   8. Adds CF tunnel entry (if CLOUDFLARE_TOKEN + TUNNEL_ID set)
#   9. Patches peerSites in all existing apps

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NAME="${1:?Usage: new-site.sh <name> <domain> <port> [--nsfw] [--require-auth]}"
DOMAIN="${2:?Usage: new-site.sh <name> <domain> <port> [--nsfw] [--require-auth]}"
PORT="${3:?Usage: new-site.sh <name> <domain> <port> [--nsfw] [--require-auth]}"

NSFW=false
REQUIRE_AUTH=false
for arg in "${@:4}"; do
  case "$arg" in
    --nsfw) NSFW=true ;;
    --require-auth) REQUIRE_AUTH=true ;;
  esac
done

SITE_URL="https://${DOMAIN}"
APP_DIR="$REPO_ROOT/apps/$NAME"
LOGO_LETTER=$(echo "$NAME" | cut -c1 | tr '[:lower:]' '[:upper:]')
TABLE_PREFIX=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]')

echo "🚀 Scaffolding: $NAME ($SITE_URL) on port $PORT"
echo "   nsfw=$NSFW requireAuth=$REQUIRE_AUTH"
echo ""

# ── 1. App directory structure ───────────────────────────────────────────────
mkdir -p "$APP_DIR/src/services"
mkdir -p "$APP_DIR/src/lib"
mkdir -p "$APP_DIR/client"

# ── 2. Backend index.ts ──────────────────────────────────────────────────────
cat > "$APP_DIR/src/index.ts" << TSEOF
import { initSentry } from '@rankbase/core/lib/sentry';
initSentry();

import { setSiteConfig } from '@rankbase/core/siteConfig';
setSiteConfig({
  name: '${NAME}',
  siteUrl: '${SITE_URL}',
  tables: {
    images: '${TABLE_PREFIX}_images',
    votes: '${TABLE_PREFIX}_votes',
    reports: '${TABLE_PREFIX}_image_reports',
    prompts: '${TABLE_PREFIX}_prompt_pool',
    hourlyImages: '${TABLE_PREFIX}_hourly_images',
    tagScoresView: 'tag_scores_live',
  },
  requireAuth: ${REQUIRE_AUTH},
  nsfw: ${NSFW},
  peerSites: [],  // TODO: add peer site URLs after running this script
});

import app from '@rankbase/core/app';
import { config } from '@rankbase/core/config';
import { logger } from '@rankbase/core/lib/logger';
import { setupGracefulShutdown } from '@rankbase/core/lib/shutdown';
import { closeRedis } from '@rankbase/core/lib/redis';
import { closeQueues } from '@rankbase/core/lib/queue';
import { registerImageGeneration } from '@rankbase/core/services/imageGenerationRegistry';
import { generateOneImage } from './services/imageGeneration';

registerImageGeneration({ generateOneImage });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, '${NAME} listening on :' + config.PORT);
});

setupGracefulShutdown(server, [closeQueues, closeRedis]);
TSEOF

# ── 3. Placeholder imageGeneration.ts ───────────────────────────────────────
cat > "$APP_DIR/src/services/imageGeneration.ts" << TSEOF
/**
 * imageGeneration.ts — ${NAME} image generation
 *
 * Replace this stub with your actual image generation logic.
 * Import providers from @rankbase/core/services/* as needed.
 */
import type { GeneratedImage } from '@rankbase/core/services/imageGenerationInterface';

export async function generateOneImage(): Promise<GeneratedImage> {
  throw new Error('imageGeneration not implemented for ${NAME} — edit src/services/imageGeneration.ts');
}
TSEOF

# ── 4. Client platform.config.ts ────────────────────────────────────────────
cat > "$APP_DIR/client/platform.config.ts" << TSEOF
import type { PlatformConfig } from '@rankbase/ui/src/platform.config';

export const platformConfig: PlatformConfig = {
  siteName: '${NAME}',
  logoLetter: '${LOGO_LETTER}',
  siteUrl: '${SITE_URL}',
  requireAuth: ${REQUIRE_AUTH},
  nsfw: ${NSFW},
  peerSites: [],  // TODO: add peer site URLs
};
TSEOF

# ── 5. Client vite.config.ts ─────────────────────────────────────────────────
cat > "$APP_DIR/client/vite.config.ts" << TSEOF
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const uiRoot = path.resolve(__dirname, '../../../packages/ui/src');

export default defineConfig({
  root: uiRoot,
  resolve: {
    alias: {
      './platform.config': path.resolve(__dirname, './platform.config.ts'),
      '../platform.config': path.resolve(__dirname, './platform.config.ts'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '${NAME}',
        short_name: '${NAME}',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon-pwa.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  build: {
    outDir: path.resolve(__dirname, '../dist/client'),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:${PORT}',
      '/health': 'http://localhost:${PORT}',
    },
  },
});
TSEOF

# ── 6. Client package.json ───────────────────────────────────────────────────
cat > "$APP_DIR/client/package.json" << JSONEOF
{
  "name": "@rankbase/${NAME}-client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build --config vite.config.ts",
    "dev": "vite --config vite.config.ts"
  },
  "dependencies": {
    "@rankbase/ui": "workspace:*"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vite-plugin-pwa": "^0.20.5"
  }
}
JSONEOF

# ── 7. App package.json ──────────────────────────────────────────────────────
cat > "$APP_DIR/package.json" << JSONEOF
{
  "name": "@rankbase/${NAME}",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "tsc",
    "build:client": "npm --prefix client run build",
    "build:all": "npm run build && npm run build:client",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "tag-images": "IMAGE_TABLE=${TABLE_PREFIX}_images NSFW=${NSFW} ts-node ../../packages/core/src/scripts/tag-images.ts"
  },
  "dependencies": {
    "@rankbase/core": "workspace:*",
    "@supabase/supabase-js": "^2.101.1",
    "express": "^5.2.1",
    "pino": "^10.3.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/node": "^25.5.0",
    "ts-node": "^10.9.2",
    "typescript": "^6.0.2"
  }
}
JSONEOF

# ── 8. tsconfig.json ─────────────────────────────────────────────────────────
cat > "$APP_DIR/tsconfig.json" << JSONEOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "ignoreDeprecations": "6.0",
    "baseUrl": ".",
    "paths": {
      "@rankbase/core": ["../../packages/core/dist/index.js"],
      "@rankbase/core/*": ["../../packages/core/dist/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "client"]
}
JSONEOF

# ── 9. .env template ─────────────────────────────────────────────────────────
cat > "$APP_DIR/.env" << ENVEOF
PORT=${PORT}
NODE_ENV=production
TRUST_PROXY=2
CORS_ORIGINS=${SITE_URL}

# Supabase (shared project)
SUPABASE_URL=https://fxcpultroloadrjfqefm.supabase.co
SUPABASE_KEY=<service_role_key>
SUPABASE_ANON_KEY=sb_publishable_sP9Z2EVMYqP10FdOE01LZw_kdB04XX1

# Redis (shared)
REDIS_URL=redis://localhost:6379

# Postgres
DATABASE_URL=<connection_string>

# Turnstile (optional)
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET=

# Cloudflare Images (optional)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_IMAGES_TOKEN=

# Sentry (optional)
SENTRY_DSN=

# Cron auth
CRON_SECRET=<generate_random>

# Image providers (add whichever you use)
FAL_KEY=
STABILITY_KEY=
OPENAI_KEY=
GOOGLE_API_KEY=
REPLICATE_TOKEN=

# R2 storage (optional)
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
ENVEOF

# ── 10. client/.env ──────────────────────────────────────────────────────────
cat > "$APP_DIR/client/.env" << ENVEOF
VITE_SUPABASE_URL=https://fxcpultroloadrjfqefm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_sP9Z2EVMYqP10FdOE01LZw_kdB04XX1
ENVEOF

# ── 11. Update Supabase redirect allowlist ───────────────────────────────────
if [ -f "$HOME/.openclaw/secrets/supabase-pat.json" ]; then
  SUPABASE_PAT=$(python3 -c "import json; print(json.load(open('$HOME/.openclaw/secrets/supabase-pat.json'))['token'].strip())")
  
  # Get current list
  CURRENT=$(curl -s -H "Authorization: Bearer $SUPABASE_PAT" \
    "https://api.supabase.com/v1/projects/fxcpultroloadrjfqefm/config/auth" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('uri_allow_list',''))")
  
  # Append new entries
  NEW_ENTRIES="${SITE_URL}/auth/callback,${SITE_URL}/**,http://localhost:${PORT}/auth/callback"
  UPDATED="${CURRENT},${NEW_ENTRIES}"
  
  curl -s -X PATCH \
    -H "Authorization: Bearer $SUPABASE_PAT" \
    -H "Content-Type: application/json" \
    "https://api.supabase.com/v1/projects/fxcpultroloadrjfqefm/config/auth" \
    -d "{\"uri_allow_list\": \"$UPDATED\"}" > /dev/null
  
  echo "✅ Supabase redirect allowlist updated"
else
  echo "⚠️  Skipped Supabase update (no PAT found)"
fi

# ── 12. Add CF tunnel entry ──────────────────────────────────────────────────
if [ -f "$HOME/.openclaw/secrets/cloudflare.json" ]; then
  python3 - << PYEOF
import json, urllib.request, urllib.error

cf = json.load(open('$HOME/.openclaw/secrets/cloudflare.json'))
token = cf['api_token']
account = cf['account_id']
tunnel_id = 'be468464-4c05-4ee9-8ab8-991a0bfa1509'

# Get current config
req = urllib.request.Request(
  f'https://api.cloudflare.com/client/v4/accounts/{account}/cfd_tunnel/{tunnel_id}/configurations',
  headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
resp = json.loads(urllib.request.urlopen(req).read())
ingress = resp['result']['config']['ingress']

# Remove the catch-all (last entry), add new site, re-add catch-all
catch_all = ingress.pop()
new_entries = [
  {'hostname': '${DOMAIN}', 'service': 'http://localhost:${PORT}', 'originRequest': {}},
  {'hostname': 'www.${DOMAIN}', 'service': 'http://localhost:${PORT}', 'originRequest': {}},
]
ingress.extend(new_entries)
ingress.append(catch_all)

# Put updated config
body = json.dumps({'config': {'ingress': ingress}}).encode()
req = urllib.request.Request(
  f'https://api.cloudflare.com/client/v4/accounts/{account}/cfd_tunnel/{tunnel_id}/configurations',
  data=body, method='PUT',
  headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
try:
  urllib.request.urlopen(req)
  print('✅ CF tunnel entry added for ${DOMAIN}')
except Exception as e:
  print(f'⚠️  CF tunnel update failed: {e}')
PYEOF
else
  echo "⚠️  Skipped CF tunnel update (no cloudflare.json)"
fi

# ── 13. Summary ──────────────────────────────────────────────────────────────
echo ""
echo "✅ Site scaffolded at apps/${NAME}/"
echo ""
echo "Next steps:"
echo "  1. Edit apps/${NAME}/.env — fill in SUPABASE_KEY, DATABASE_URL, CRON_SECRET"
echo "  2. Edit apps/${NAME}/src/services/imageGeneration.ts — implement your provider"
echo "  3. Create Postgres tables:"
echo "     ${TABLE_PREFIX}_images, ${TABLE_PREFIX}_votes, ${TABLE_PREFIX}_image_reports,"
echo "     ${TABLE_PREFIX}_prompt_pool, ${TABLE_PREFIX}_hourly_images"
echo "  4. Add peerSites to apps/${NAME}/src/index.ts and apps/${NAME}/client/platform.config.ts"
echo "  5. Add '${SITE_URL}' to peerSites in all existing apps"
echo "  6. Run: cd apps/${NAME} && pnpm install && pnpm build"
echo "  7. Start: pm2 start dist/index.js --name ${NAME}"
echo ""
echo "DNS: Point ${DOMAIN} to CF tunnel be468464-4c05-4ee9-8ab8-991a0bfa1509.cfargotunnel.com"
