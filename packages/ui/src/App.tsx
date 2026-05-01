import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/Skeleton';
import { ComparePage } from './pages/Compare';
import { usePageview } from './hooks/usePageview';

/**
 * Compare loads eagerly because it's the default landing page — making the
 * user wait for a chunk download on the most common entry hurts. The other
 * routes lazy-load so they only ship their bundle when navigated to.
 */
const LeaderboardPage = lazy(() =>
  import('./pages/Leaderboard').then((m) => ({ default: m.LeaderboardPage }))
);
const TagboardPage = lazy(() =>
  import('./pages/Tagboard').then((m) => ({ default: m.TagboardPage }))
);
const ProvidersPage = lazy(() =>
  import('./pages/Providers').then((m) => ({ default: m.ProvidersPage }))
);
const AdminPage = lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminPage })));
const ImageDetailPage = lazy(() =>
  import('./pages/ImageDetail').then((m) => ({ default: m.ImageDetailPage }))
);
const TagDetailPage = lazy(() =>
  import('./pages/TagDetail').then((m) => ({ default: m.TagDetailPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFound').then((m) => ({ default: m.NotFoundPage }))
);
const LoginPage = lazy(() => import('./pages/Login').then((m) => ({ default: m.LoginPage })));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallback').then((m) => ({ default: m.AuthCallbackPage })));

function RouteFallback() {
  return (
    <div style={{ padding: '1.5rem 0' }}>
      <Skeleton width="200px" height="2rem" />
      <div style={{ marginTop: '1rem' }}>
        <Skeleton width="100%" height="240px" radius="12px" />
      </div>
    </div>
  );
}

function Router() {
  usePageview();
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/compare" replace />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/tagboard" element={<TagboardPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/images/:id" element={<ImageDetailPage />} />
        <Route path="/tags/:tag" element={<TagDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Layout>
          <Router />
        </Layout>
      </AuthProvider>
    </ErrorBoundary>
  );
}
