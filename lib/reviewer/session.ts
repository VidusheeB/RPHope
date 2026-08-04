// Server-side reviewer session helpers. Reads the logged-in user from the
// cookie session (RLS-scoped anon client) and their reviewer_profiles row.
// Role / can_publish come from the DATABASE via this server path — never from
// anything the client sends.

import { redirect } from "next/navigation";
import { getServerSupabase } from "../supabaseServer";
import { getServiceSupabase } from "../supabaseAdmin";
import { reviewHref } from "./paths";

const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

export type ReviewerProfile = {
  user_id: string;
  display_name: string;
  role: "reviewer" | "admin";
  can_publish: boolean;
  active: boolean;
};

export type ReviewerSession = {
  userId: string;
  email: string | null;
  profile: ReviewerProfile;
};

/** The current reviewer session, or null if not logged in / no active profile. */
export async function getReviewerSession(): Promise<ReviewerSession | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("reviewer_profiles")
    .select("user_id, display_name, role, can_publish, active, last_active_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !profile.active) return null;

  // Throttled last_active_at update — reviewer_profiles has no self-update
  // RLS policy (only admins may write it, to prevent a reviewer touching
  // their own role/can_publish), so this one narrow, trusted column touch
  // uses the service-role client. Throttled so it's "last active", not an
  // activity event on every single page render.
  const lastActiveAt = profile.last_active_at ? new Date(profile.last_active_at).getTime() : 0;
  if (Date.now() - lastActiveAt > LAST_ACTIVE_THROTTLE_MS) {
    const service = getServiceSupabase();
    if (service) {
      await service
        .from("reviewer_profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }
  }

  return { userId: user.id, email: user.email ?? null, profile: profile as ReviewerProfile };
}

/** Require a logged-in, active reviewer; redirect to login otherwise. */
export async function requireReviewer(): Promise<ReviewerSession> {
  const session = await getReviewerSession();
  if (!session) redirect(reviewHref("/login"));
  return session;
}

/** Require an admin; redirect non-admins to the dashboard. */
export async function requireAdmin(): Promise<ReviewerSession> {
  const session = await requireReviewer();
  if (session.profile.role !== "admin") redirect(reviewHref(""));
  return session;
}
