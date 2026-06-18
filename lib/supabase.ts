import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase env vars are present. Used to fall back to local data. */
export const supabaseConfigured = Boolean(url && anonKey);

/**
 * Read-only client for the public site (anon key + RLS → only `published` rows).
 * Returns null when not configured, so callers can fall back to local data and
 * the app keeps working on localhost before Supabase is set up.
 */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  return createClient(url!, anonKey!, {
    auth: { persistSession: false },
  });
}
