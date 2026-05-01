import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ProviderLeaderboardResponse } from '../types';
import { ErrorState } from '../components/ErrorState';
import { ProviderBadge } from '../components/ProviderBadge';
import { Skeleton } from '../components/Skeleton';
import { useApi } from '../hooks/useApi';
import styles from './Providers.module.css';

export function ProvidersPage() {
  const { data, error, loading, refetch } = useApi<ProviderLeaderboardResponse>(
    () => api.providersLeaderboard(),
    []
  );

  if (loading) {
    return (
      <div>
        <Header />
        <div className={styles.grid} aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.card}>
              <Skeleton width="7rem" height="1.5rem" />
              <Skeleton width="100%" height="8rem" />
              <Skeleton width="70%" height="1rem" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <div>
      <Header />
      {!data || data.providers.length === 0 ? (
        <div className={styles.empty}>No provider data yet.</div>
      ) : (
        <ol className={styles.grid} aria-label="Provider standings">
          {data.providers.map((provider, index) => (
            <li key={provider.provider} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.rank}>#{index + 1}</span>
                <ProviderBadge provider={provider.provider} />
              </div>
              <dl className={styles.metrics}>
                <div>
                  <dt>Avg ELO</dt>
                  <dd>{Math.round(provider.avgElo)}</dd>
                </div>
                <div>
                  <dt>Images</dt>
                  <dd>{provider.imageCount}</dd>
                </div>
                <div>
                  <dt>Votes</dt>
                  <dd>{provider.totalVotes}</dd>
                </div>
              </dl>
              {provider.topImage && (
                <Link to={`/images/${provider.topImage.id}`} className={styles.topImage}>
                  <img src={provider.topImage.url} alt="" loading="lazy" />
                  <span>{Math.round(provider.maxElo)} ELO top image</span>
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Header() {
  return (
    <header className={styles.header}>
      <h1>Provider Standings</h1>
      <p>Visible images grouped by generation provider</p>
    </header>
  );
}
