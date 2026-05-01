import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>404</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        We couldn't find that page.
      </p>
      <Link to="/compare">Go vote on some images →</Link>
    </div>
  );
}
