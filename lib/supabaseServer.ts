// Server-side Supabase client bound to the reviewer's cookie session
// (@supabase/ssr). Uses the ANON key + the logged-in user's JWT, so every read
// and write it performs is subject to Row Level Security — a reviewer reaches
// only the drafts assigned to them. NEVER the service-role key; this client is
// safe to use in server components, route handlers, and server actions.
//
// setAll is wrapped in try/catch because Next.js server COMPONENTS can't mutate
// cookies (only route handlers / server actions can). When called from a
// component the refresh write is silently skipped, which is the documented
// @supabase/ssr pattern.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // called from a Server Component — cookie writes are a no-op here.
        }
      },
    },
  });
}
