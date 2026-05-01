import { Link, NavLink } from 'react-router-dom';
import { api } from '../api/client';
import type { TagboardResponse } from '../types';
import { useApi } from '../hooks/useApi';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import styles from './Tagboard.module.css';

export function TagboardPage() {
  const { data, error, loading, refetch } = useApi<TagboardResponse>(() => api.tagboard(20, 0), []);

  if (loading) {
    return (
      <div>
        <Header onRefresh={refetch} />
        <div className={styles.list}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.row}>
              <Skeleton width="2rem" height="1em" />
              <Skeleton width="8rem" height="1em" />
              <Skeleton width="4rem" height="1em" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!data || data.tags.length === 0) {
    return (
      <div>
        <Header onRefresh={refetch} />
        <div className={styles.empty}>
          <p>No tags yet — images are being tagged.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header onRefresh={refetch} />
      <ol className={styles.list} aria-label="Tag rankings">
        {data.tags.map((tag, i) => (
          <li key={tag.tag} className={styles.row}>
            <span className={styles.rank}>#{i + 1}</span>
            <Link to={`/tags/${encodeURIComponent(tag.tag)}`} className={styles.tag}>
              {tag.tag}
            </Link>
            <span className={styles.score}>{Math.round(tag.score)}</span>
            <span className={styles.count}>{tag.image_count} img</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Header({ onRefresh }: { onRefresh: () => void }) {
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1>Tag Rankings</h1>
        <div className={styles.actions}>
          <NavLink to="/compare" className={styles.actionBtn}>
            🗳 Vote
          </NavLink>
          <NavLink to="/leaderboard" className={styles.actionBtn}>
            🏆 Leaderboard
          </NavLink>
          <button type="button" className={styles.actionBtn} onClick={onRefresh}>
            ↺ Refresh
          </button>
        </div>
      </div>
      <p className={styles.subtitle}>Top tags by average ELO — live</p>
    </header>
  );
}
