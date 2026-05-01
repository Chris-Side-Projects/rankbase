import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // We handle the OAuth callback manually in AuthCallback.tsx
    // to avoid race conditions between SDK auto-exchange and React rendering
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
