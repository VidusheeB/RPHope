// Service-role Supabase client — SERVER ONLY. Bypasses RLS, so it can write
// `pending_review` research items. NEVER import this from a client component;
// the service-role key must never reach the browser. Used by the research-pull
// cron route and the manual research:pull script.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdminConfigured = Boolean(url && serviceKey);

export function getServiceSupabase(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
