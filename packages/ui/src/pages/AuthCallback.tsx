/**
 * AuthCallback.tsx — OAuth/magic link landing page
 *
 * Handles two flows Supabase uses when redirecting back to our app:
 *
 * 1. PKCE / authorization_code (?code= in URL):
 *    Supabase sends a short-lived code. We call exchangeCodeForSession(code)
 *    which hits Supabase's token endpoint and stores the session.
 *
 * 2. Implicit (#access_token= in hash):
 *    Supabase sends tokens directly in the URL hash. We parse them and call
 *    setSession() because detectSessionInUrl:false means the SDK won't do it.
 *
 * After establishing the session we redirect to the stored destination.
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

      // ── PKCE / authorization_code flow: ?code= ────────────────────────────
      const code = url.searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('OAuth code exchange failed:', error.message);
          navigate('/login?error=oauth_failed', { replace: true });
          return;
        }
        sessionStorage.removeItem('auth_redirect');
        navigate(dest, { replace: true });
        return;
      }

      // ── Implicit flow: #access_token= in hash ────────────────────────────
      const hash = url.hash.slice(1); // strip leading #
      if (hash) {
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          // detectSessionInUrl:false means SDK won't auto-parse — do it manually
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            console.error('OAuth setSession failed:', error.message);
            navigate('/login?error=oauth_failed', { replace: true });
            return;
          }
          sessionStorage.removeItem('auth_redirect');
          navigate(dest, { replace: true });
          return;
        }
      }

      // ── Already signed in (e.g. returning to callback page) ──────────────
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        sessionStorage.removeItem('auth_redirect');
        navigate(dest, { replace: true });
        return;
      }

      // Nothing worked — back to login
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
