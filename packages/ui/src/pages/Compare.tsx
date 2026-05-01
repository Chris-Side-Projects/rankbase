import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { platformConfig } from '../platform.config';
import { api, ApiError } from '../api/client';
import type { CompareResponse, Image } from '../types';
import { useApi } from '../hooks/useApi';
import { useDeviceHash } from '../hooks/useDeviceHash';
import { useKeyboard } from '../hooks/useKeyboard';
import { useSwipe } from '../hooks/useSwipe';
import { useImagePreload } from '../hooks/useImagePreload';
import { Turnstile } from '../components/Turnstile';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { Toast } from '../components/Toast';
import { ProviderBadge } from '../components/ProviderBadge';
import { ReportButton } from '../components/ReportButton';
import { track } from '../lib/analytics';
import { withViewTransition } from '../lib/viewTransition';
import styles from './Compare.module.css';

/**
 * Head-to-head voting page.
 *
 * Inputs:
 *   - Click an image
 *   - Keyboard:  A / ←  vote left   ·   D / →  vote right   ·   S / ↑  skip
 *   - Touch:     swipe left  (vote right — image you swiped TOWARDS wins)
 *                swipe right (vote left)
 *
 * UX details:
 *   - During submit we keep the old pair on screen with the buttons
 *     disabled, so the swap to the next pair feels seamless.
 *   - Image preload on the current pair warms the browser cache; even
 *     though the next pair is server-selected, common image reuse means
 *     this still helps.
 *   - View Transitions API crossfades the swap on supporting browsers
 *     (Chrome 111+, Safari 18+); pre-View-Transitions browsers get the
 *     same plain swap as before.
 */
export function ComparePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  // deviceHashForFetch is a ref so refetch() always sends the latest hash
  // without triggering a re-render loop.
  const deviceHashForFetch = useRef<string | undefined>(undefined);
  // Track whether we've completed the hash-gated fetch. Until this is true,
  // suppress displaying any pair — prevents voting on a pair that arrived
  // from the un-hashed initial fetch (which has no voted-pair exclusion).
  const [readyToShow, setReadyToShow] = useState(false);
  const { data, error, loading, refetch } = useApi<CompareResponse>(
    () => api.compare(deviceHashForFetch.current),
    []
  );
  const deviceHash = useDeviceHash(data?.clientIp);

  // Once deviceHash resolves, re-fetch with exclusions applied, then mark ready.
  useEffect(() => {
    if (!deviceHash) return;
    deviceHashForFetch.current = deviceHash;
    if (!readyToShow) {
      void refetch().then(() => setReadyToShow(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceHash]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    kind: 'success' | 'error' | 'info';
  } | null>(null);

  // Cache the displayed pair locally so we don't blank out the UI between
  // the vote click and the next /api/compare landing.
  const [pair, setPair] = useState<[Image, Image] | null>(null);
  useEffect(() => {
    // Only render pairs once the hash-gated fetch is complete.
    // This prevents a voted pair (from the un-hashed initial fetch) from
    // briefly appearing before exclusions are applied.
    if (!readyToShow) return;
    if (data?.pair) {
      withViewTransition(() => setPair(data.pair));
    } else if (data && data.pair === null) {
      setPair(null);
      if (data.exhausted) {
        navigate('/leaderboard?voted=all');
      }
    }
  }, [data, navigate, readyToShow]);

  // Warm the browser cache for the current pair's image URLs.
  useImagePreload([pair?.[0]?.url, pair?.[1]?.url]);

  const resetTurnstile = useCallback(() => setTurnstileToken(null), []);

  const submitVote = useCallback(
    async (winner: Image, loser: Image) => {
      if (submitting || !deviceHash) return;
      if (platformConfig.requireAuth && !user) {
        navigate('/login', { state: { from: '/compare' } });
        return;
      }
      if (data?.turnstileSiteKey && !turnstileToken) {
        setToast({ message: 'Please complete the challenge first.', kind: 'error' });
        return;
      }
      setSubmitting(true);
      try {
        // Get the current session token for server-side JWT verification
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const result = await api.vote({
          winnerId: winner.id,
          loserId: loser.id,
          deviceHash,
          authToken: session?.access_token,
          turnstileToken: turnstileToken ?? undefined,
        });
        const delta = result.newWinnerElo - Math.round(winner.elo);
        track({ type: 'vote_cast', elo_delta: delta });
        setToast({ message: `+${delta} ELO — loading next pair...`, kind: 'success' });
        resetTurnstile();
        await refetch();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          track({ type: 'vote_error', code: 'DUPLICATE' });
          setToast({ message: 'You already voted on this pair. Loading next...', kind: 'info' });
          await refetch();
        } else if (err instanceof Error) {
          track({
            type: 'vote_error',
            code: err instanceof ApiError ? err.code : 'UNKNOWN',
          });
          setToast({ message: err.message, kind: 'error' });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, deviceHash, data?.turnstileSiteKey, turnstileToken, refetch, resetTurnstile]
  );

  const skip = useCallback(() => {
    resetTurnstile();
    void refetch();
  }, [refetch, resetTurnstile]);

  // Keep keyboard handlers fresh without re-binding the listener every render.
  const handlersRef = useRef({ submitVote, skip, pair });
  handlersRef.current = { submitVote, skip, pair };
  const voteLeft = () =>
    handlersRef.current.pair &&
    handlersRef.current.submitVote(handlersRef.current.pair[0], handlersRef.current.pair[1]);
  const voteRight = () =>
    handlersRef.current.pair &&
    handlersRef.current.submitVote(handlersRef.current.pair[1], handlersRef.current.pair[0]);

  useKeyboard({
    a: voteLeft,
    ArrowLeft: voteLeft,
    d: voteRight,
    ArrowRight: voteRight,
    s: () => handlersRef.current.skip(),
    ArrowUp: () => handlersRef.current.skip(),
  });

  // Swipe → vote for the image you swiped TOWARDS. Right-swipe means you
  // pulled the right side toward you, so the right image wins. (UI-tested
  // direction; if it feels wrong we can flip.)
  const swipeProps = useSwipe({ onSwipeLeft: voteRight, onSwipeRight: voteLeft });

  if (!readyToShow || (loading && !pair)) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Which image is better?</h1>
        <div className={styles.arena}>
          <Skeleton width="100%" height="360px" radius="12px" />
          <div className={styles.vs} aria-hidden="true">
            VS
          </div>
          <Skeleton width="100%" height="360px" radius="12px" />
        </div>
      </div>
    );
  }

  if (error) return <ErrorState error={error} retry={refetch} />;

  if (!pair) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Not enough images yet</h1>
        <p className={styles.subtitle}>
          Generate some images first via the <code>POST /api/generate</code> endpoint.
        </p>
      </div>
    );
  }

  const [a, b] = pair;

  return (
    <div className={styles.page} {...swipeProps}>
      <h1 className={styles.title}>Which image is better?</h1>
      <p className={styles.subtitle}>
        Click or press <kbd>A</kbd>/<kbd>D</kbd> · <kbd>S</kbd> to skip · swipe on touch
      </p>

      <div className={styles.arena}>
        <ImageChoice
          image={a}
          disabled={submitting}
          onPick={() => submitVote(a, b)}
          label="Left — press A"
          turnstileSiteKey={data?.turnstileSiteKey}
        />
        <div className={styles.vs} aria-hidden="true">
          VS
        </div>
        <ImageChoice
          image={b}
          disabled={submitting}
          onPick={() => submitVote(b, a)}
          label="Right — press D"
          turnstileSiteKey={data?.turnstileSiteKey}
        />
      </div>

      <div className={styles.actions}>
        {platformConfig.requireAuth && !authLoading && !user && (
          <p className={styles.authPrompt}>
            <Link to="/login" state={{ from: '/compare' }}>
              Sign in
            </Link>{' '}
            to vote and track your picks.
          </p>
        )}
        <button type="button" className={styles.skipLink} onClick={skip} disabled={submitting}>
          Skip this pair
        </button>
      </div>

      {data?.turnstileSiteKey && (
        <div className={styles.turnstile} aria-label="Bot challenge">
          <Turnstile siteKey={data.turnstileSiteKey} onToken={setTurnstileToken} />
        </div>
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}

function ImageChoice({
  image,
  onPick,
  disabled,
  label,
  turnstileSiteKey,
}: {
  image: Image;
  onPick: () => void;
  disabled: boolean;
  label: string;
  turnstileSiteKey?: string | null;
}) {
  return (
    <article className={styles.choice}>
      <button
        type="button"
        className={styles.card}
        onClick={onPick}
        disabled={disabled}
        aria-label={`Vote for: ${image.prompt}. ${label}.`}
      >
        <img src={image.url} alt="" loading="lazy" />
        <div className={styles.choiceBody}>
          <ProviderBadge provider={image.provider} />
          <p className={styles.prompt}>{image.prompt}</p>
        </div>
      </button>
      <div className={styles.choiceActions}>
        <ReportButton
          imageId={image.id}
          imagePrompt={image.prompt}
          turnstileSiteKey={turnstileSiteKey}
        />
      </div>
    </article>
  );
}
