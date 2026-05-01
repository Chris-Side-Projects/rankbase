/**
 * Shared type definitions mirroring the backend JSON contract.
 * Keep in sync with src/routes/api/*.ts on the server.
 */

export interface Image {
  id: string;
  url: string;
  prompt: string;
  tags: string[];
  elo: number;
  votes: number;
  created_at: string;
  provider?: string | null;
  hidden?: boolean;
  moderation_score?: number | null;
}

export type Period = 'all' | 'month' | 'week';

export interface TagScore {
  tag: string;
  score: number;
  image_count: number;
  updated_at: string;
}

export interface LeaderboardResponse {
  images: Image[];
  limit: number;
  offset: number;
  period: Period;
  turnstileSiteKey?: string | null;
}

export interface TagboardResponse {
  tags: TagScore[];
  limit: number;
  offset: number;
}

export interface CompareResponse {
  pair: [Image, Image] | null;
  exhausted: boolean;
  turnstileSiteKey: string | null;
  clientIp: string;
}

export interface VoteResponse {
  winnerId: string;
  loserId: string;
  newWinnerElo: number;
  newLoserElo: number;
}

export type ReportReason = 'offensive' | 'low_quality' | 'copyright' | 'nsfw' | 'other';

export interface ImageReportResult {
  id: string;
  imageId: string;
  reason: ReportReason;
  status: ReportStatus;
  created_at: string;
}

export interface ReportImageResponse {
  report: ImageReportResult;
  autoHidden: boolean;
  distinctReporters: number;
}

export interface ProviderStanding {
  provider: string;
  label: string;
  imageCount: number;
  avgElo: number;
  maxElo: number;
  totalVotes: number;
  topImage: Image | null;
}

export interface ProviderLeaderboardResponse {
  providers: ProviderStanding[];
}

export type AdminHiddenFilter = 'all' | 'visible' | 'hidden';
export type ReportStatus = 'open' | 'reviewed' | 'dismissed';
export type AdminReportStatusFilter = ReportStatus | 'all';

export interface AdminProviderStats {
  provider: string;
  image_count: number;
  avg_elo: number;
  max_elo: number;
  total_votes: number;
  hidden_count: number;
}

export interface AdminStatsResponse {
  providers: AdminProviderStats[];
}

export interface AdminImagesResponse {
  images: Image[];
  limit: number;
  offset: number;
  hidden: AdminHiddenFilter;
}

export interface AdminModerateResponse {
  id: string;
  hidden: boolean;
}

export interface AdminImageReport {
  id: string;
  image_id: string;
  reason: ReportReason;
  notes: string | null;
  status: ReportStatus;
  created_at: string;
  images: Image | null;
}

export interface AdminReportsResponse {
  reports: AdminImageReport[];
  limit: number;
  offset: number;
  status: AdminReportStatusFilter;
}

export interface AdminResolveReportResponse {
  id: string;
  status: ReportStatus;
}

export interface ImageVote {
  id: string;
  created_at: string;
  won: boolean;
  opponentId: string;
}

export interface ImageDetailResponse {
  image: Image;
  recentVotes: ImageVote[];
  turnstileSiteKey?: string | null;
}

export interface TagImagesResponse {
  tag: string;
  images: Image[];
  limit: number;
  offset: number;
  turnstileSiteKey?: string | null;
}

export interface ApiErrorResponse {
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}
