"use client";

// Browser Supabase client for reviewer client components (@supabase/ssr).
// ANON key + the reviewer's cookie session only — RLS-scoped, never the
// service-role key. Used for interactive editing/autosave on the review page.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  _client = createBrowserClient(url, anonKey);
  return _client;
}
