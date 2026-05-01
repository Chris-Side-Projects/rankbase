/**
 * aega.art platform configuration — backend
 */
export const platformConfig = {
  siteName: 'aega.art',
  logoLetter: 'A',
  siteUrl: 'https://aega.art',
  requireAuth: true,
  nsfw: true,
  /** Postgres schema prefix — tables are aega_images, aega_votes, etc. */
  schema: 'aega',
  providers: ['civitai', 'fal', 'replicate', 'getimg'] as const,
} as const;

export type AegaPlatformConfig = typeof platformConfig;
