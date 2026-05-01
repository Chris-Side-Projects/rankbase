import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Image, TagImagesResponse } from '../types';
import { ErrorState } from '../components/ErrorState';
import { ProviderBadge } from '../components/ProviderBadge';
import { ReportButton } from '../components/ReportButton';
import { Skeleton } from '../components/Skeleton';
import { useApi } from '../hooks/useApi';
import styles from './TagDetail.module.css';

const PAGE_SIZE = 20;

export function TagDetailPage() {
  const { tag: rawTag = '' } = useParams();
  const tag = decodeTag(rawTag);
  const [offset, setOffset] = useState(0);
  const [images, setImages] = useState<Image[]>([]);

  const { data, error, loading, refetch } = useApi<TagImagesResponse>(
    () => api.tagImages(tag, PAGE_SIZE, offset),
    [tag, offset]
  );

  useEffect(() => {
    setOffset(0);
    setImages([]);
  }, [tag]);

  useEffect(() => {
    if (!data || data.tag !== tag || data.offset !== offset) return;
    if (data.offset === 0) {
      setImages(data.images);
    } else {
      setImages((prev) => [...prev, ...data.images]);
    }
  }, [data, offset, tag]);

  const hasMore = data?.tag === tag && data.offset === offset && data.images.length === PAGE_SIZE;

  return (
    <div>
      <header className={styles.header}>
        <h1>{tag}</h1>
        <p>Images ranked by ELO</p>
      </header>

      {error && <ErrorState error={error} retry={refetch} />}

      {loading && images.length === 0 ? (
        <div className={styles.grid} aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.card}>
              <Skeleton width="100%" height="220px" radius="0" />
              <Skeleton width="75%" height="1rem" />
            </div>
          ))}
        </div>
      ) : images.length === 0 && !loading ? (
        <div className={styles.empty}>No images for this tag yet.</div>
      ) : (
        <>
          <ol className={styles.grid} aria-label={`${tag} images`}>
            {images.map((image) => (
              <li key={image.id} className={styles.card}>
                <Link to={`/images/${image.id}`} className={styles.imageLink}>
                  <img src={image.url} alt="" loading="lazy" />
                </Link>
                <div className={styles.body}>
                  <div className={styles.cardMeta}>
                    <ProviderBadge provider={image.provider} />
                    <ReportButton
                      imageId={image.id}
                      imagePrompt={image.prompt}
                      turnstileSiteKey={data?.turnstileSiteKey}
                    />
                  </div>
                  <Link to={`/images/${image.id}`} className={styles.prompt}>
                    {image.prompt}
                  </Link>
                  <div className={styles.stats}>
                    <span>{Math.round(image.elo)} ELO</span>
                    <span>{image.votes} votes</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {hasMore && (
            <div className={styles.loadMore}>
              <button
                type="button"
                onClick={() => setOffset((value) => value + PAGE_SIZE)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function decodeTag(tag: string) {
  try {
    return decodeURIComponent(tag);
  } catch {
    return tag;
  }
}
