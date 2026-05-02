import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { config } from './config';
import { requestId } from './middleware/requestId';
import { httpLogger, logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getSupabase } from './services/supabase';
import { imageOpenGraphMeta, injectOpenGraphMeta } from './lib/openGraph';

// Route imports
import generateRouter from './routes/generate';
import compareRouter from './routes/compare';
import voteRouter from './routes/vote';
import leaderboardRouter from './routes/leaderboard';
import tagboardRouter from './routes/tagboard';
import aggregateTagsRouter from './routes/aggregateTags';
import apiRouter from './routes/api';
import healthRouter from './routes/health';
import promptsRouter from './routes/prompts';

// Middleware imports
import { cronAuth } from './middleware/cronAuth';
import { rateLimit } from './middleware/rateLimit';

const app: ReturnType<typeof express> = express();

// ---------------------------------------------------------------------------
// Proxy trust — controls how far up the X-Forwarded-For chain we read
// req.ip from. Configurable because the right value depends on the deploy
// shape: 1 hop for nginx-on-same-box, 2 for Cloudflare + nginx, etc.
// Pass a number or one of express' string keywords ('loopback', etc.).
// `true` would let any client forge their IP — never use that.
// ---------------------------------------------------------------------------
const trustProxy = /^\d+$/.test(config.TRUST_PROXY)
  ? Number(config.TRUST_PROXY)
  : config.TRUST_PROXY;
app.set('trust proxy', trustProxy);

// ---------------------------------------------------------------------------
// Observability: correlation ID + structured request log
// ---------------------------------------------------------------------------
app.use(requestId);
app.use(httpLogger);

// ---------------------------------------------------------------------------
// Security headers via helmet.
//
// helmet() sets a safe default pack — HSTS, X-Frame-Options, X-Content-Type-
// Options, Referrer-Policy, etc. We override the CSP to explicitly allow
// the third-party surfaces this app needs:
//   - Cloudflare Turnstile (script + iframe on the vote page)
//   - Cloudflare Images (img src for generated images)
//
// We allow 'unsafe-inline' for scripts and styles today because the EJS views
// ship inline JS/CSS. Once the React SPA lands (Phase 4b) this should tighten
// to a nonce-based policy with no inline allowance.
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': [
          "'self'",
          'data:',
          'https://imagedelivery.net',
          'https://*.r2.cloudflarestorage.com',
          'https://pub-r2.aega.art',
          'https://pub-r2.imgrank.app',
          'https://pub-be62f2d4e647494598a738607675bbd2.r2.dev',
        ],
        'frame-src': ['https://challenges.cloudflare.com'],
        'connect-src': ["'self'", 'https://*.supabase.co'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      },
    },
    // HSTS with preload — safe in production, skipped in dev so localhost works
    hsts: config.IS_PRODUCTION
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
    crossOriginEmbedderPolicy: false, // would break cross-origin image loads
  })
);

// ---------------------------------------------------------------------------
// CORS. Disabled unless CORS_ORIGINS is set. In the classic server-rendered
// flow we don't need CORS at all; we set this up for the forthcoming SPA
// that might be served from a different origin.
// ---------------------------------------------------------------------------
if (config.CORS_ORIGINS) {
  const origins =
    config.CORS_ORIGINS === '*'
      ? '*'
      : config.CORS_ORIGINS.split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  app.use(
    cors({
      origin: origins,
      credentials: false,
      methods: ['GET', 'POST', 'OPTIONS'],
    })
  );
}

// ---------------------------------------------------------------------------
// Body parsers — capped so a large POST can't exhaust memory.
// ---------------------------------------------------------------------------
app.use(express.json({ limit: config.BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: config.BODY_LIMIT }));

// EJS view engine — templates live in src/views/
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------------------------------------------------------------------------
// Static assets
// ---------------------------------------------------------------------------
// Built SPA (Phase 4b) lands in dist/client/. If the directory exists we
// serve it with aggressive caching. The directory won't exist until the
// client is built, so we guard the mount.
const clientDir = path.join(__dirname, '..', 'dist', 'client');
const clientIndexPath = path.join(clientDir, 'index.html');
if (existsSync(clientDir)) {
  app.use(
    express.static(clientDir, {
      // Hashed bundle files (index-abc123.js) can be cached forever; plain
      // HTML files should revalidate on every request.
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
}
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// JSON API (new, preferred) — used by the SPA frontend
app.use('/api', apiRouter);

// Legacy server-rendered routes (kept for backward compat until SPA fully ships)
app.use('/generate', cronAuth, rateLimit(5, 60_000), generateRouter);
app.use('/compare', compareRouter);
app.use('/vote', rateLimit(30, 60_000), voteRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/tagboard', tagboardRouter);
app.use('/aggregate-tags', cronAuth, aggregateTagsRouter);
app.use('/prompts', promptsRouter);

// /health (liveness, cheap) + /ready (downstream probe).
app.use('/', healthRouter);

// SPA fallback: if the client bundle is built, any unknown GET serves
// index.html so client-side routing can take over. Uses app.use (not
// app.get('*')) because Express 5's path-to-regexp v8 requires named
// wildcards, and a middleware with no path matches every method/path.
if (existsSync(clientDir)) {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    // Don't hijack API routes, health checks, or the legacy EJS pages.
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/compare') ||
      req.path.startsWith('/leaderboard') ||
      req.path.startsWith('/tagboard') ||
      req.path.startsWith('/generate') ||
      req.path.startsWith('/aggregate-tags') ||
      req.path.startsWith('/vote') ||
      req.path.startsWith('/prompts')
    ) {
      return next();
    }
    if (req.path.startsWith('/images/')) {
      const html = await imageDetailHtml(req);
      if (html) {
        res.setHeader('Cache-Control', 'no-cache');
        res.type('html').send(html);
        return;
      }
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });
} else {
  // No SPA built — root redirects to the EJS leaderboard
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/leaderboard');
  });
}

// ---------------------------------------------------------------------------
// Error plumbing (must be registered last)
// ---------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

// Surface uncaught/unhandled failures in the process log so we know they
// happened even before any structured handling catches them.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
});

export default app;

interface OgImageRow {
  url: string;
  prompt: string;
  elo: number;
  votes: number;
}

async function imageDetailHtml(req: Request): Promise<string | null> {
  const id = req.path.slice('/images/'.length).split('/')[0];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  try {
    const { data, error } = await getSupabase()
      .from('aega_images')
      .select('url, prompt, elo, votes')
      .eq('id', id)
      .eq('hidden', false)
      .single();

    if (error || !data) return null;

    const html = readFileSync(clientIndexPath, 'utf8');
    const image = data as OgImageRow;
    return injectOpenGraphMeta(
      html,
      imageOpenGraphMeta({
        prompt: image.prompt,
        imageUrl: image.url,
        pageUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        elo: image.elo,
        votes: image.votes,
      })
    );
  } catch (err) {
    logger.warn({ err, imageId: id }, 'image Open Graph rewrite failed');
    return null;
  }
}
