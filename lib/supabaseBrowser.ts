"use client";

// Browser Supabase client — ANON key only, never the service-role key.
// Originally built for reviewer client components (@supabase/ssr binds the
// reviewer's cookie session, so RLS scopes edits to their assignments), but
// it's just a plain anon-key client, so it's also reused by the public
// story-video upload flow (app/share-your-story/), which needs a client
// instance to call storage.uploadToSignedUrl() — authorization there comes
// from the signed-URL token itself (minted server-side), not from any
// session on this client.

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
