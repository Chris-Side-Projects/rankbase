/**
 * AuthRelay.tsx — Cross-domain SSO session receiver
 *
 * Loaded in a hidden iframe from a peer site after that site's user logs in.
 * Reads access_token + refresh_token from the URL hash and calls setSession()
 * to establish the session in this origin's localStorage.
 *
 * URL format (set by AuthContext on peer site):
 *   /auth/relay#access_token=X&refresh_token=Y&expires_in=Z&token_type=bearer
 *
 * Security: tokens are short-lived JWTs signed by Supabase. An attacker would
 * need to intercept the iframe src URL (same-origin iframe, no cross-origin
 * reads). The relay only runs from known peer origins defined in platformConfig.
 */

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function AuthRelayPage() {
  useEffect(() => {
    async function relay() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;

      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (!access_token || !refresh_token) return;

      try {
        await supabase.auth.setSession({ access_token, refresh_token });
        // Signal parent iframe that relay succeeded
        window.parent.postMessage({ type: 'AUTH_RELAY_DONE', success: true }, '*');
      } catch {
        window.parent.postMessage({ type: 'AUTH_RELAY_DONE', success: false }, '*');
      }
    }

    relay();
  }, []);

  // Invisible — this page is only ever loaded in a hidden iframe
  return null;
}
