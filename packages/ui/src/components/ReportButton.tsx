import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { ReportReason } from '../types';
import { Turnstile } from './Turnstile';
import styles from './ReportButton.module.css';

const DEVICE_KEY = 'aega_art_report_device_seed';
const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'offensive', label: 'Offensive' },
  { value: 'nsfw', label: 'NSFW' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'low_quality', label: 'Low quality' },
  { value: 'other', label: 'Other' },
];

interface ReportButtonProps {
  imageId: string;
  imagePrompt: string;
  turnstileSiteKey?: string | null;
  className?: string;
}

export function ReportButton({
  imageId,
  imagePrompt,
  turnstileSiteKey,
  className,
}: ReportButtonProps) {
  const deviceHash = useReportDeviceHash();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('offensive');
  const [notes, setNotes] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setOpen(false);
    setStatus(null);
    setNotes('');
    setTurnstileToken(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deviceHash || submitting) return;
    if (turnstileSiteKey && !turnstileToken) {
      setStatus({ kind: 'error', message: 'Complete the challenge first.' });
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      const result = await api.reportImage({
        imageId,
        reason,
        notes,
        deviceHash,
        turnstileToken: turnstileToken ?? undefined,
      });
      setStatus({
        kind: 'success',
        message: result.autoHidden ? 'Report submitted and image hidden.' : 'Report submitted.',
      });
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 429
          ? 'Report limit reached. Try again later.'
          : err instanceof Error
            ? err.message
            : 'Report failed.';
      setStatus({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${className ?? ''}`}
        onClick={() => setOpen(true)}
      >
        Report
      </button>
      {open && (
        <div className={styles.backdrop} role="presentation" onMouseDown={close}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`report-title-${imageId}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <form onSubmit={submit}>
              <div className={styles.header}>
                <h2 id={`report-title-${imageId}`}>Report Image</h2>
                <button
                  type="button"
                  className={styles.close}
                  onClick={close}
                  aria-label="Close report dialog"
                >
                  x
                </button>
              </div>
              <p className={styles.prompt}>{imagePrompt}</p>
              <label>
                Reason
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ReportReason)}
                >
                  {REASONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={500}
                  rows={4}
                />
              </label>
              {turnstileSiteKey && (
                <div className={styles.turnstile}>
                  <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
                </div>
              )}
              {status && (
                <p
                  className={status.kind === 'success' ? styles.success : styles.error}
                  role="status"
                >
                  {status.message}
                </p>
              )}
              <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={close}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !deviceHash || Boolean(status?.kind === 'success')}
                >
                  {submitting ? 'Submitting...' : 'Submit report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function useReportDeviceHash() {
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seed = getDeviceSeed();
      const raw = `${navigator.userAgent}|${seed}`;
      const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const hex = Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      if (!cancelled) setHash(hex);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return hash;
}

function getDeviceSeed() {
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const next =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_KEY, next);
  return next;
}
