// Server-side reviewer session helpers. Reads the logged-in user from the
// cookie session (RLS-scoped anon client) and their reviewer_profiles row.
// Role / can_publish come from the DATABASE via this server path — never from
// anything the client sends.

import { redirect } from "next/navigation";
import { getServerSupabase } from "../supabaseServer";

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
    .select("user_id, display_name, role, can_publish, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !profile.active) return null;
  return { userId: user.id, email: user.email ?? null, profile: profile as ReviewerProfile };
}

/** Require a logged-in, active reviewer; redirect to login otherwise. */
export async function requireReviewer(): Promise<ReviewerSession> {
  const session = await getReviewerSession();
  if (!session) redirect("/review/login");
  return session;
}

/** Require an admin; redirect non-admins to the dashboard. */
export async function requireAdmin(): Promise<ReviewerSession> {
  const session = await requireReviewer();
  if (session.profile.role !== "admin") redirect("/review");
  return session;
}
