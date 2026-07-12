// Service-role Supabase client — SERVER ONLY. Bypasses RLS, so it can write
// `pending_review` research items. NEVER import this from a client component;
// the service-role key must never reach the browser. Used by the research-pull
// cron route and the manual research:pull / gene-pages:draft scripts.
//
// Env vars are read lazily (inside the functions), not at module load. CLI
// scripts call `dotenv.config()` themselves before touching this module, but
// tsx hoists ES-style imports above other top-level statements, so a
// module-level `const url = process.env...` here would capture `undefined`
// even though dotenv.config() runs moments later. Reading lazily makes this
// module correct regardless of import order or when the module was loaded
// relative to env setup.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
