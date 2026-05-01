/**
 * AuthCallback.tsx
 *
 * Handles both PKCE (?code=) and implicit (#access_token=) OAuth flows.
 * Explicitly exchanges the code rather than relying on the SDK's auto-detection
 * timing, which can race with React rendering.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const dest = sessionStorage.getItem('auth_redirect') ?? '/compare';

    async function handle() {
      const url = new URL(window.location.href);

      // PKCE flow: ?code= query param
      const code = url.searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('OAuth exchange failed:', error.message);
          navigate('/login?error=oauth_failed', { replace: true });
          return;
        }
        sessionStorage.removeItem('auth_redirect');
        navigate(dest, { replace: true });
        return;
      }

      // Implicit flow: #access_token= hash fragment
      const hash = url.hash;
      if (hash && hash.includes('access_token')) {
        // SDK handles hash automatically — just wait for the SIGNED_IN event
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            subscription.unsubscribe();
            sessionStorage.removeItem('auth_redirect');
            navigate(dest, { replace: true });
          }
        });
        // Also check if session already established
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          subscription.unsubscribe();
          sessionStorage.removeItem('auth_redirect');
          navigate(dest, { replace: true });
        }
        return;
      }

      // Already signed in (e.g. magic link already processed)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        sessionStorage.removeItem('auth_redirect');
        navigate(dest, { replace: true });
        return;
      }

      // Nothing to handle — back to login
      navigate('/login', { replace: true });
    }

    handle();
  }, [navigate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Signing you in…</p>
    </div>
  );
}
