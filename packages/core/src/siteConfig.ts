/**
 * siteConfig.ts - Server-side site configuration
 *
 * Each app sets this once at startup (before importing app.ts) via
 * `setSiteConfig(config)`. All core routes read from `getSiteConfig()`
 * instead of hardcoding table names or site-specific values.
 *
 * This is the server-side counterpart to the client-side PlatformConfig.
 *
 * Adding a new site = create a new app/<name>/src/index.ts that calls setSiteConfig()
 * with its own tables and options, then registers its image generation provider.
 * Zero changes to packages/core.
 */

export interface DbTables {
  /** Main images table */
  images: string;
  /** Votes table */
  votes: string;
  /** Image reports table */
  reports: string;
  /** Prompt pool table */
  prompts: string;
  /** Hourly generated images table */
  hourlyImages: string;
  /** Tag scores view (live computed) */
  tagScoresView: string;
}

export interface SiteConfig {
  /** Human-readable site name for logs */
  name: string;
  /** Canonical production URL - used for CORS and SSO relay */
  siteUrl: string;
  /** Database table names for this site */
  tables: DbTables;
  /** Whether voting requires a logged-in user */
  requireAuth: boolean;
  /** Whether this site serves NSFW content */
  nsfw: boolean;
  /** Supabase DB schema (default: 'public') */
  dbSchema?: string;
  /** Supabase RPC for cast_vote */
  castVoteRpc?: string;
  /** Other site URLs in the SSO ring (for documentation/tooling - relay is client-side) */
  peerSites?: string[];
}

/** Sensible defaults for every field that has one */
const DEFAULTS = {
  dbSchema: 'public',
  castVoteRpc: 'cast_vote',
  requireAuth: false,
  nsfw: false,
  peerSites: [] as string[],
} as const;

let _config: SiteConfig | null = null;

/** Called once at app startup, before app.ts is imported. */
export function setSiteConfig(cfg: SiteConfig): void {
  _config = { ...DEFAULTS, ...cfg };
}

/** Returns the active site config. Throws if setSiteConfig was never called. */
export function getSiteConfig(): SiteConfig & typeof DEFAULTS {
  if (!_config) {
    throw new Error(
      'getSiteConfig() called before setSiteConfig(). ' +
        'Call setSiteConfig() in your app entry point before importing app.ts.'
    );
  }
  return _config as SiteConfig & typeof DEFAULTS;
}

// ─── Pre-built table configs for known sites ──────────────────────────────────
// Apps can use these or define their own inline.

export const AEGA_TABLES: DbTables = {
  images: 'aega_images',
  votes: 'aega_votes',
  reports: 'aega_image_reports',
  prompts: 'aega_prompt_pool',
  hourlyImages: 'aega_hourly_images',
  tagScoresView: 'tag_scores_live',
};

export const IMGRANK_TABLES: DbTables = {
  images: 'images',
  votes: 'votes',
  reports: 'image_reports',
  prompts: 'prompt_pool',
  hourlyImages: 'hourly_images',
  tagScoresView: 'tag_scores_live',
};
