import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ImageDetailResponse } from '../types';
import { ErrorState } from '../components/ErrorState';
import { ProviderBadge } from '../components/ProviderBadge';
import { ReportButton } from '../components/ReportButton';
import { Skeleton } from '../components/Skeleton';
import { useApi } from '../hooks/useApi';
import styles from './ImageDetail.module.css';

export function ImageDetailPage() {
  const { id = '' } = useParams();
  const [copied, setCopied] = useState(false);
  const { data, error, loading, refetch } = useApi<ImageDetailResponse>(
    () => api.imageDetail(id),
    [id]
  );

  const share = async () => {
    const url = window.location.href;
    const title = data?.image.prompt ?? 'aega.art image';
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  if (loading) {
    return (
      <div className={styles.shell}>
        <Skeleton width="100%" height="520px" radius="10px" />
        <div className={styles.panel}>
          <Skeleton width="8rem" height="1.5rem" />
          <Skeleton width="80%" height="1rem" />
          <Skeleton width="50%" height="1rem" />
        </div>
      </div>
    );
  }

  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!data) return null;

  const { image, recentVotes } = data;

  return (
    <article className={styles.shell}>
      <img className={styles.image} src={image.url} alt="" />
      <section className={styles.panel}>
        <div className={styles.meta}>
          <ProviderBadge provider={image.provider} />
          <span>{Math.round(image.elo)} ELO</span>
          <span>{image.votes} votes</span>
        </div>
        <h1>{image.prompt}</h1>
        {image.tags.length > 0 && (
          <div className={styles.tags}>
            {image.tags.map((tag) => (
              <Link key={tag} to={`/tags/${encodeURIComponent(tag)}`}>
                {tag}
              </Link>
            ))}
          </div>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.shareButton} onClick={share}>
            {copied ? 'Copied' : 'Share'}
          </button>
          <ReportButton
            imageId={image.id}
            imagePrompt={image.prompt}
            turnstileSiteKey={data.turnstileSiteKey}
          />
        </div>

        <div className={styles.votes}>
          <h2>Recent Votes</h2>
          {recentVotes.length === 0 ? (
            <p className={styles.emptyLine}>No vote history yet.</p>
          ) : (
            <ol>
              {recentVotes.map((vote) => (
                <li key={vote.id}>
                  <span className={vote.won ? styles.win : styles.loss}>
                    {vote.won ? 'Won' : 'Lost'}
                  </span>
                  <span>{new Date(vote.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </article>
  );
}
