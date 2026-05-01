import type {
  AdminHiddenFilter,
  AdminImagesResponse,
  AdminModerateResponse,
  AdminReportStatusFilter,
  AdminReportsResponse,
  AdminResolveReportResponse,
  AdminStatsResponse,
  ApiErrorResponse,
  CompareResponse,
  ImageDetailResponse,
  LeaderboardResponse,
  Period,
  ProviderLeaderboardResponse,
  ReportImageResponse,
  ReportReason,
  TagboardResponse,
  TagImagesResponse,
  VoteResponse,
} from '../types';

/**
 * Typed error raised by the API client when the backend returns a non-2xx.
 * Components can `instanceof ApiError` to branch on the error code.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId?: string;
  public readonly retryAfter?: number;
  constructor(status: number, body: ApiErrorResponse, retryAfter?: number) {
    super(body.error?.message ?? `HTTP ${status}`);
    this.status = status;
    this.code = body.error?.code ?? 'UNKNOWN';
    this.requestId = body.requestId;
    this.retryAfter = retryAfter;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: ApiErrorResponse;
    try {
      body = await res.json();
    } catch {
      body = {
        error: { code: 'UNKNOWN', message: `HTTP ${res.status}` },
        requestId: '',
      };
    }
    const retryAfter = Number(res.headers.get('retry-after') ?? '') || undefined;
    throw new ApiError(res.status, body, retryAfter);
  }

  // 204 No Content and like
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function adminHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  leaderboard: (limit = 20, offset = 0, period: Period = 'all') => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      period,
    });
    return request<LeaderboardResponse>(`/api/leaderboard?${params.toString()}`);
  },

  tagboard: (limit = 20, offset = 0) =>
    request<TagboardResponse>(`/api/tagboard?limit=${limit}&offset=${offset}`),

  providersLeaderboard: () => request<ProviderLeaderboardResponse>('/api/providers/leaderboard'),

  imageDetail: (id: string) =>
    request<ImageDetailResponse>(`/api/images/${encodeURIComponent(id)}`),

  reportImage: (body: {
    imageId: string;
    reason: ReportReason;
    deviceHash: string;
    notes?: string;
    turnstileToken?: string;
  }) =>
    request<ReportImageResponse>(`/api/images/${encodeURIComponent(body.imageId)}/report`, {
      method: 'POST',
      body: JSON.stringify({
        reason: body.reason,
        deviceHash: body.deviceHash,
        notes: body.notes,
        'cf-turnstile-response': body.turnstileToken,
      }),
    }),

  tagImages: (tag: string, limit = 20, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    return request<TagImagesResponse>(`/api/tags/${encodeURIComponent(tag)}/images?${params}`);
  },

  compare: (deviceHash?: string) =>
    request<CompareResponse>(
      deviceHash ? `/api/compare?deviceHash=${encodeURIComponent(deviceHash)}` : '/api/compare'
    ),

  vote: (body: {
    winnerId: string;
    loserId: string;
    deviceHash: string;
    authToken?: string;
    turnstileToken?: string;
  }) =>
    request<VoteResponse>('/api/vote', {
      method: 'POST',
      headers: body.authToken ? { Authorization: `Bearer ${body.authToken}` } : undefined,
      body: JSON.stringify({
        winnerId: body.winnerId,
        loserId: body.loserId,
        deviceHash: body.deviceHash,
        'cf-turnstile-response': body.turnstileToken,
      }),
    }),

  adminStats: (token: string) =>
    request<AdminStatsResponse>('/api/admin/stats', {
      headers: adminHeaders(token),
    }),

  adminImages: (token: string, limit = 24, offset = 0, hidden: AdminHiddenFilter = 'all') => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      hidden,
    });
    return request<AdminImagesResponse>(`/api/admin/images?${params}`, {
      headers: adminHeaders(token),
    });
  },

  adminReports: (
    token: string,
    limit = 24,
    offset = 0,
    status: AdminReportStatusFilter = 'open'
  ) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      status,
    });
    return request<AdminReportsResponse>(`/api/admin/reports?${params}`, {
      headers: adminHeaders(token),
    });
  },

  adminModerateImage: (token: string, id: string, hidden: boolean) =>
    request<AdminModerateResponse>(`/api/admin/images/${encodeURIComponent(id)}/moderate`, {
      method: 'POST',
      headers: adminHeaders(token),
      body: JSON.stringify({ hidden }),
    }),

  adminResolveReport: (token: string, id: string, status: 'reviewed' | 'dismissed') =>
    request<AdminResolveReportResponse>(`/api/admin/reports/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: adminHeaders(token),
      body: JSON.stringify({ status }),
    }),
};
