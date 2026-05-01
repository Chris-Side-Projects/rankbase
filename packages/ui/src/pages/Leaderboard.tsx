import { useEffect, useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Image, LeaderboardResponse, Period } from '../types';
import { useApi } from '../hooks/useApi';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { Tabs, type TabOption } from '../components/Tabs';
import { ProviderBadge } from '../components/ProviderBadge';
import { ReportButton } from '../components/ReportButton';
import styles from './Leaderboard.module.css';

const PAGE_SIZE = 20;
const PERIOD_OPTIONS: Array<TabOption<Period>> = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'week', label: 'This week' },
];
const PERIOD_VALUES = new Set<Period>(['all', 'month', 'week']);

function parsePeriod(value: string | null): Period {
  return value && PERIOD_VALUES.has(value as Period) ? (value as Period) : 'all';
}

/**
 * Top-N images by ELO with progressive "Load more" pagination.
 *
 * State model: `offset` is the next page to fetch; `accumulated` is every
 * image we've already pulled. When `useApi` resolves with a new `data`
 * object, we append its images to `accumulated` (in an effect, never in
 * the render body — React 18 strict mode catches in-render setState as a
 * bug).
 */
export function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));
  const votedAll = searchParams.get('voted') === 'all';
  const [offset, setOffset] = useState(0);
  const [accumulated, setAccumulated] = useState<Image[]>([]);

  const { data, error, loading, refetch } = useApi<LeaderboardResponse>(
    () => api.leaderboard(PAGE_SIZE, offset, period),
    [offset, period]
  );

  useEffect(() => {
    setOffset(0);
    setAccumulated([]);
  }, [period]);

  // Append on every successful fetch. Resetting accumulated on offset=0 lets
  // a manual refetch (after a vote, etc.) correctly replace stale rows.
  useEffect(() => {
    if (!data) return;
    if (data.period !== period || data.offset !== offset) return;
    if (data.offset === 0) {
      setAccumulated(data.images);
    } else {
      setAccumulated((prev) => [...prev, ...data.images]);
    }
  }, [data, offset, period]);

  const handlePeriodChange = (nextPeriod: Period) => {
    if (nextPeriod === period) return;
    setOffset(0);
    setAccumulated([]);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPeriod === 'all') {
        next.delete('period');
      } else {
        next.set('period', nextPeriod);
      }
      return next;
    });
  };

  const images = accumulated;
  const hasMore =
    data?.period === period && data.offset === offset && data.images.length === PAGE_SIZE;

  return (
    <div>
      <header className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Leaderboard</h1>
            <div className={styles.actions}>
              <NavLink to="/compare" className={styles.actionBtn}>
                🗳 Vote
              </NavLink>
              <NavLink to="/tagboard" className={styles.actionBtn}>
                🏷 Tags
              </NavLink>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  setOffset(0);
                  setAccumulated([]);
                  void refetch();
                }}
              >
                ↺ Refresh
              </button>
            </div>
          </div>
          <p className={styles.subtitle}>Top AI-generated images ranked by ELO</p>
          {votedAll && (
            <p
              style={{
                marginTop: '0.75rem',
                padding: '0.6rem 1rem',
                background: 'rgba(99,255,132,0.12)',
                borderRadius: '8px',
                color: '#63ff84',
                fontSize: '0.9rem',
              }}
            >
              🎉 You&apos;ve voted on every pair! New images are generating — come back soon to vote
              more.
            </p>
          )}
        </div>
        <Tabs
          label="Leaderboard period"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={handlePeriodChange}
        />
      </header>

      {error && <ErrorState error={error} retry={refetch} />}

      {loading && images.length === 0 ? (
        <SkeletonGrid count={8} />
      ) : images.length === 0 && !loading ? (
        <EmptyState />
      ) : (
        <>
          <ol className={styles.grid} aria-label="Leaderboard rankings">
            {images.map((image, idx) => (
              <LeaderCard
                key={image.id}
                image={image}
                rank={idx + 1}
                turnstileSiteKey={data?.turnstileSiteKey}
              />
            ))}
          </ol>
          {hasMore && (
            <div className={styles.loadMore}>
              <button
                type="button"
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeaderCard({
  image,
  rank,
  turnstileSiteKey,
}: {
  image: Image;
  rank: number;
  turnstileSiteKey?: string | null;
}) {
  const rankClass =
    rank === 1 ? styles.gold : rank === 2 ? styles.silver : rank === 3 ? styles.bronze : '';
  return (
    <li className={styles.card}>
      <span className={`${styles.rank} ${rankClass}`}>#{rank}</span>
      <Link
        to={`/images/${image.id}`}
        className={styles.imageLink}
        aria-label={`Open ${image.prompt}`}
      >
        <img src={image.url} alt="" loading="lazy" />
      </Link>
      <div className={styles.body}>
        <div className={styles.cardMeta}>
          <ProviderBadge provider={image.provider} />
          <ReportButton
            imageId={image.id}
            imagePrompt={image.prompt}
            turnstileSiteKey={turnstileSiteKey}
          />
        </div>
        <Link to={`/images/${image.id}`} className={styles.prompt}>
          {image.prompt}
        </Link>
        <div className={styles.stats}>
          <span className={styles.elo}>{Math.round(image.elo)} ELO</span>
          <span className={styles.votes}>{image.votes} votes</span>
        </div>
        {image.tags && image.tags.length > 0 && (
          <div className={styles.tags}>
            {image.tags.slice(0, 4).map((tag) => (
              <Link key={tag} to={`/tags/${encodeURIComponent(tag)}`} className={styles.tag}>
                {tag}
              </Link>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.card}>
          <Skeleton width="100%" height="240px" radius="0" />
          <div className={styles.body}>
            <Skeleton width="80%" height="1em" />
            <Skeleton width="50%" height="0.9em" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <h2>Nothing here yet</h2>
      <p>
        Generate some images first: <code>POST /api/generate</code>.
      </p>
    </div>
  );
}
