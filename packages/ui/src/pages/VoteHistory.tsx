import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { ErrorState } from '../components/ErrorState';
import { Skeleton } from '../components/Skeleton';
import styles from './VoteHistory.module.css';

interface HistoryImage {
  id: string;
  url: string;
  prompt: string;
  elo?: number;
}

interface HistoryEntry {
  id: string;
  created_at: string;
  winnerId: string;
  winner: HistoryImage | null;
  loser: HistoryImage | null;
}

interface VoteHistoryResponse {
  history: HistoryEntry[];
}

async function fetchHistory(): Promise<VoteHistoryResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch('/api/votes/history', {
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined,
    credentials: 'same-origin',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VoteHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, error, loading } = useApi<VoteHistoryResponse>(fetchHistory, [user?.id]);

  // Redirect to login if not authenticated
  if (!authLoading && !user) return <Navigate to="/login" state={{ from: '/history' }} replace />;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Vote History</h1>
      <p className={styles.subtitle}>The last 50 image pairs you voted on</p>

      {loading && (
        <div className={styles.list}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height="120px" radius="10px" />
          ))}
        </div>
      )}

      {error && <ErrorState error={error} />}

      {!loading && !error && data?.history.length === 0 && (
        <div className={styles.empty}>
          <p>You haven't voted on any images yet.</p>
          <Link to="/compare">Start voting →</Link>
        </div>
      )}

      {!loading && !error && data && data.history.length > 0 && (
        <div className={styles.list}>
          {data.history.map((entry) => (
            <div key={entry.id} className={styles.card}>
              <ImageSlot image={entry.winner} won />
              <div className={styles.vsCol}>
                <span className={styles.vs}>VS</span>
                <span className={styles.date}>{formatDate(entry.created_at)}</span>
              </div>
              <ImageSlot image={entry.loser} won={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageSlot({ image, won }: { image: HistoryImage | null; won: boolean }) {
  if (!image) {
    return (
      <div className={styles.imageSlot}>
        <div className={styles.missing}>—</div>
      </div>
    );
  }

  return (
    <div className={styles.imageSlot}>
      <Link to={`/images/${image.id}`} className={styles.imageWrap}>
        <img className={styles.thumb} src={image.url} alt={image.prompt} loading="lazy" />
        <span className={`${styles.badge} ${won ? styles.winBadge : styles.loseBadge}`}>
          {won ? 'Won' : 'Lost'}
        </span>
      </Link>
      <span className={styles.imageLabel} title={image.prompt}>
        {image.prompt.slice(0, 60)}
        {image.prompt.length > 60 ? '…' : ''}
      </span>
    </div>
  );
}
