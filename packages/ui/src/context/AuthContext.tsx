import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { platformConfig } from '../platform.config';

/** Fire-and-forget: relay session tokens to all peer sites via hidden iframe */
function relaySessionToPeers(session: Session) {
  const peers = platformConfig.peerSites ?? [];
  if (!peers.length) return;

  const { access_token, refresh_token } = session;
  const hash = `#access_token=${access_token}&refresh_token=${refresh_token}&token_type=bearer`;

  for (const peer of peers) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute;';
    iframe.src = `${peer}/auth/relay${hash}`;
    document.body.appendChild(iframe);
    // Clean up after 10s regardless of outcome
    setTimeout(() => iframe.remove(), 10_000);
  }
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const relayedRef = useRef<string | null>(null);

  useEffect(() => {
    console.log('[auth:context] mounting at', window.location.pathname);

    // Safety net: if an implicit-flow #access_token= hash landed on this page
    const hash = window.location.hash.slice(1);
    if (hash && hash.includes('access_token=')) {
      console.log('[auth:context] implicit hash detected on', window.location.pathname, '— applying setSession');
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          console.log('[auth:context] safety-net setSession =>', { user: data?.session?.user?.email, error: error?.message });
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        });
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[auth:context] getSession =>', session?.user?.email ?? 'no session');
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[auth:context] onAuthStateChange:', event, '| user:', session?.user?.email ?? 'none');
      setSession(session);
      // Relay to peer sites on fresh sign-in (deduplicate by token)
      if (event === 'SIGNED_IN' && session) {
        const tokenId = session.access_token.slice(-16);
        if (relayedRef.current !== tokenId) {
          relayedRef.current = tokenId;
          relaySessionToPeers(session);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
