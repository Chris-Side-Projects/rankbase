/**
 * PlatformConfig interface — each app provides its own implementation.
 *
 * The actual platformConfig value is injected per-app via Vite path aliases
 * so shared UI code can import from '../platform.config' and get the
 * app-specific values at build time.
 */
export interface PlatformConfig {
  /** Display name shown in the nav and page titles */
  siteName: string;
  /** Single letter shown in the nav logo badge */
  logoLetter: string;
  /** Canonical site URL */
  siteUrl: string;
  /** Whether voting requires authentication */
  requireAuth: boolean;
  /** Whether this platform serves NSFW content */
  nsfw: boolean;
  /** Other sites in the same SSO ring — session is relayed to all on login */
  peerSites?: string[];
}

// Re-exported so apps can import the type easily
export type { PlatformConfig as default };
