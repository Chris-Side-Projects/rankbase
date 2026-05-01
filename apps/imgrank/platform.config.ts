/**
 * imgrank platform configuration — backend
 */
export const platformConfig = {
  siteName: 'imgrank',
  logoLetter: 'S',
  siteUrl: 'https://imgrank.app',
  requireAuth: false,
  nsfw: false,
  /** Postgres schema prefix — uses default public schema */
  schema: 'public',
  providers: ['stability', 'openai', 'gemini', 'google'] as const,
} as const;

export type ImgrankPlatformConfig = typeof platformConfig;
