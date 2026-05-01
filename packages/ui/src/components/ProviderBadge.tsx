import styles from './ProviderBadge.module.css';

const LABELS: Record<string, string> = {
  stability: 'Stability',
  dalle: 'DALL-E',
  imagen: 'Imagen',
  unknown: 'Unknown',
  '(unknown)': 'Unknown',
};

function normalize(provider: string | null | undefined) {
  return provider?.trim() || 'unknown';
}

function providerClass(provider: string) {
  if (provider === 'stability') return styles.stability;
  if (provider === 'dalle') return styles.dalle;
  if (provider === 'imagen') return styles.imagen;
  return styles.unknown;
}

function providerLabel(provider: string | null | undefined) {
  const normalized = normalize(provider);
  return LABELS[normalized] ?? normalized;
}

export function ProviderBadge({ provider }: { provider?: string | null }) {
  const normalized = normalize(provider);
  return (
    <span className={`${styles.badge} ${providerClass(normalized)}`}>
      {providerLabel(normalized)}
    </span>
  );
}
