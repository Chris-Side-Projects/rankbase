import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api/client';
import type {
  AdminHiddenFilter,
  AdminImageReport,
  AdminImagesResponse,
  AdminReportStatusFilter,
  AdminReportsResponse,
  AdminStatsResponse,
  Image,
} from '../types';
import { ErrorState } from '../components/ErrorState';
import { ProviderBadge } from '../components/ProviderBadge';
import { Skeleton } from '../components/Skeleton';
import { Tabs, type TabOption } from '../components/Tabs';
import { useApi } from '../hooks/useApi';
import styles from './Admin.module.css';

const STORAGE_KEY = 'aega_art_admin_token';
const VIEW_OPTIONS: Array<TabOption<'queue' | 'reports' | 'stats'>> = [
  { value: 'queue', label: 'Queue' },
  { value: 'reports', label: 'Reports' },
  { value: 'stats', label: 'Stats' },
];
const FILTER_OPTIONS: Array<TabOption<AdminHiddenFilter>> = [
  { value: 'all', label: 'All' },
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
];
const REPORT_STATUS_OPTIONS: Array<TabOption<AdminReportStatusFilter>> = [
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

function initialToken() {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(STORAGE_KEY) ?? '';
}

export function AdminPage() {
  const [token, setToken] = useState(initialToken);
  const [draftToken, setDraftToken] = useState('');
  const [view, setView] = useState<'queue' | 'reports' | 'stats'>('queue');
  const [hiddenFilter, setHiddenFilter] = useState<AdminHiddenFilter>('all');
  const [reportStatus, setReportStatus] = useState<AdminReportStatusFilter>('open');
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const stats = useApi<AdminStatsResponse>(
    () => (token ? api.adminStats(token) : Promise.resolve({ providers: [] })),
    [token, refreshKey]
  );
  const images = useApi<AdminImagesResponse>(
    () =>
      token
        ? api.adminImages(token, 24, 0, hiddenFilter)
        : Promise.resolve({ images: [], limit: 24, offset: 0, hidden: hiddenFilter }),
    [token, hiddenFilter, refreshKey]
  );
  const reports = useApi<AdminReportsResponse>(
    () =>
      token
        ? api.adminReports(token, 24, 0, reportStatus)
        : Promise.resolve({ reports: [], limit: 24, offset: 0, status: reportStatus }),
    [token, reportStatus, refreshKey]
  );

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextToken = draftToken.trim();
    if (!nextToken) return;
    window.sessionStorage.setItem(STORAGE_KEY, nextToken);
    setToken(nextToken);
    setDraftToken('');
  };

  const clearToken = () => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setToken('');
    setDraftToken('');
  };

  const refresh = () => setRefreshKey((key) => key + 1);

  const moderate = async (image: Image, hidden: boolean) => {
    if (!token) return;
    setPendingId(image.id);
    try {
      await api.adminModerateImage(token, image.id, hidden);
      refresh();
    } finally {
      setPendingId(null);
    }
  };

  const resolveReport = async (report: AdminImageReport, status: 'reviewed' | 'dismissed') => {
    if (!token) return;
    setPendingId(report.id);
    try {
      await api.adminResolveReport(token, report.id, status);
      refresh();
    } finally {
      setPendingId(null);
    }
  };

  if (!token) {
    return (
      <div className={styles.loginShell}>
        <form className={styles.login} onSubmit={login}>
          <h1>Admin</h1>
          <label htmlFor="admin-token">Admin token</label>
          <input
            id="admin-token"
            type="password"
            value={draftToken}
            onChange={(event) => setDraftToken(event.target.value)}
            autoComplete="current-password"
          />
          <button type="submit">Unlock</button>
        </form>
      </div>
    );
  }

  const currentError =
    view === 'queue' ? images.error : view === 'reports' ? reports.error : stats.error;
  const unauthorized = currentError instanceof ApiError && currentError.status === 401;

  return (
    <div>
      <header className={styles.header}>
        <div>
          <h1>Admin</h1>
          <p>Moderation queue and provider stats</p>
        </div>
        <div className={styles.headerActions}>
          <Tabs label="Admin view" options={VIEW_OPTIONS} value={view} onChange={setView} />
          <button type="button" className={styles.secondaryButton} onClick={clearToken}>
            Lock
          </button>
        </div>
      </header>

      {currentError && (
        <div className={styles.errorBlock}>
          <ErrorState
            error={currentError}
            retry={
              view === 'queue'
                ? images.refetch
                : view === 'reports'
                  ? reports.refetch
                  : stats.refetch
            }
          />
          {unauthorized && (
            <button type="button" className={styles.secondaryButton} onClick={clearToken}>
              Clear token
            </button>
          )}
        </div>
      )}

      {view === 'queue' ? (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Moderation Queue</h2>
            <Tabs
              label="Image visibility"
              options={FILTER_OPTIONS}
              value={hiddenFilter}
              onChange={setHiddenFilter}
            />
          </div>
          {images.loading ? (
            <QueueSkeleton />
          ) : (
            <ImageQueue
              images={images.data?.images ?? []}
              pendingId={pendingId}
              onModerate={moderate}
            />
          )}
        </section>
      ) : view === 'reports' ? (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Reports</h2>
            <Tabs
              label="Report status"
              options={REPORT_STATUS_OPTIONS}
              value={reportStatus}
              onChange={setReportStatus}
            />
          </div>
          {reports.loading ? (
            <QueueSkeleton />
          ) : (
            <ReportQueue
              reports={reports.data?.reports ?? []}
              pendingId={pendingId}
              onModerate={moderate}
              onResolve={resolveReport}
            />
          )}
        </section>
      ) : (
        <section className={styles.section}>
          <h2>Provider Stats</h2>
          {stats.loading ? <StatsSkeleton /> : <ProviderStatsTable stats={stats.data} />}
        </section>
      )}
    </div>
  );
}

function ReportQueue({
  reports,
  pendingId,
  onModerate,
  onResolve,
}: {
  reports: AdminImageReport[];
  pendingId: string | null;
  onModerate: (image: Image, hidden: boolean) => void;
  onResolve: (report: AdminImageReport, status: 'reviewed' | 'dismissed') => void;
}) {
  if (reports.length === 0)
    return <div className={styles.empty}>No reports match this filter.</div>;

  return (
    <div className={styles.queue}>
      {reports.map((report) => {
        const image = report.images;
        return (
          <article key={report.id} className={styles.imageCard}>
            {image ? (
              <img src={image.url} alt="" loading="lazy" />
            ) : (
              <div className={styles.missingImage} />
            )}
            <div className={styles.imageBody}>
              <div className={styles.imageMeta}>
                <span>{report.reason.replace('_', ' ')}</span>
                <span>{report.status}</span>
                <span>{new Date(report.created_at).toLocaleDateString()}</span>
              </div>
              <p>{image?.prompt ?? 'Image no longer exists.'}</p>
              {report.notes && <p className={styles.notes}>{report.notes}</p>}
              <div className={styles.reportActions}>
                {image && (
                  <button
                    type="button"
                    onClick={() => onModerate(image, !image.hidden)}
                    disabled={pendingId === report.id || pendingId === image.id}
                  >
                    {image.hidden ? 'Unhide' : 'Hide'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onResolve(report, 'reviewed')}
                  disabled={pendingId === report.id || report.status === 'reviewed'}
                >
                  Reviewed
                </button>
                <button
                  type="button"
                  onClick={() => onResolve(report, 'dismissed')}
                  disabled={pendingId === report.id || report.status === 'dismissed'}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ImageQueue({
  images,
  pendingId,
  onModerate,
}: {
  images: Image[];
  pendingId: string | null;
  onModerate: (image: Image, hidden: boolean) => void;
}) {
  if (images.length === 0) return <div className={styles.empty}>No images match this filter.</div>;

  return (
    <div className={styles.queue}>
      {images.map((image) => (
        <article key={image.id} className={styles.imageCard}>
          <img src={image.url} alt="" loading="lazy" />
          <div className={styles.imageBody}>
            <div className={styles.imageMeta}>
              <ProviderBadge provider={image.provider} />
              <span>{formatScore(image.moderation_score)} score</span>
              <span>{image.hidden ? 'Hidden' : 'Visible'}</span>
            </div>
            <p>{image.prompt}</p>
            <button
              type="button"
              onClick={() => onModerate(image, !image.hidden)}
              disabled={pendingId === image.id}
            >
              {image.hidden ? 'Unhide' : 'Hide'}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProviderStatsTable({ stats }: { stats: AdminStatsResponse | null }) {
  const providers = stats?.providers ?? [];
  if (providers.length === 0) return <div className={styles.empty}>No provider stats yet.</div>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Images</th>
            <th>Avg ELO</th>
            <th>Max ELO</th>
            <th>Votes</th>
            <th>Hidden</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => (
            <tr key={provider.provider}>
              <td>
                <ProviderBadge provider={provider.provider} />
              </td>
              <td>{provider.image_count}</td>
              <td>{Math.round(provider.avg_elo)}</td>
              <td>{Math.round(provider.max_elo)}</td>
              <td>{provider.total_votes}</td>
              <td>{provider.hidden_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className={styles.queue} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <article key={i} className={styles.imageCard}>
          <Skeleton width="100%" height="160px" radius="0" />
          <div className={styles.imageBody}>
            <Skeleton width="8rem" height="1rem" />
            <Skeleton width="80%" height="1rem" />
            <Skeleton width="5rem" height="2rem" />
          </div>
        </article>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className={styles.tableWrap} aria-hidden="true">
      <Skeleton width="100%" height="180px" radius="8px" />
    </div>
  );
}

function formatScore(score: number | null | undefined) {
  return `${Math.round(Number(score ?? 0) * 100)}%`;
}
