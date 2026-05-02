import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// AUTH DEBUG — remove after login is confirmed working
console.log('[auth:init] VITE_SUPABASE_URL =', supabaseUrl || '⚠️ EMPTY');
console.log('[auth:init] VITE_SUPABASE_ANON_KEY =', supabaseAnonKey ? supabaseAnonKey.slice(0, 20) + '...' : '⚠️ EMPTY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE flow: Supabase returns ?code= to /auth/callback; we exchange it manually.
    // This ensures redirectTo is respected and tokens never land on the wrong page.
    flowType: 'pkce',
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
