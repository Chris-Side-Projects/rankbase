import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Lazy-initialized singleton Supabase client using the service_role key.
 * Uses the 'aega' schema for all queries (separate namespace from imgrank/public).
 * Typed as `any` to avoid TypeScript schema-literal conflicts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabase(): any {
  if (!_supabase) {
    if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
    }
    _supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
  }
  return _supabase;
}
