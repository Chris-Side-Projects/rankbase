/**
 * AuthCallback.tsx
 *
 * Landing page for OAuth redirects (Google, magic link, etc).
 *
 * Supabase puts tokens in the URL hash after OAuth. The JS SDK's
 * `onAuthStateChange` detects the hash fragment and establishes the session
 * automatically when the client loads — but only if it gets a chance to run
 * before we navigate away. This page just waits for that to happen, then
 * redirects to wherever the user was going.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // supabase-js v2 automatically parses the hash/query params and calls
    // onAuthStateChange with the new session. We just wait for it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe();
        // Redirect to the stored destination, or home
        const dest = sessionStorage.getItem('auth_redirect') ?? '/compare';
        sessionStorage.removeItem('auth_redirect');
        navigate(dest, { replace: true });
      }
    });

    // Fallback: if already signed in (session already loaded), redirect immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        const dest = sessionStorage.getItem('auth_redirect') ?? '/compare';
        sessionStorage.removeItem('auth_redirect');
        navigate(dest, { replace: true });
      }
    });

    // Timeout fallback — if nothing happens in 5s, go to login
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      navigate('/login', { replace: true });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Signing you in…</p>
    </div>
  );
}
