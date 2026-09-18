// Server-side portal session helpers. Reads the logged-in user from the
// cookie session (RLS-scoped anon client) and their reviewer_profiles row.
// Role / can_publish come from the DATABASE via this server path — never from
// anything the client sends.
//
// Authorization is expressed in CAPABILITIES, not role names — see
// ./permissions for the clearance table and why. Nothing outside this file
// and that one should compare a role string.

import { redirect } from "next/navigation";
import { getServerSupabase } from "../supabaseServer";
import { getServiceSupabase } from "../supabaseAdmin";
import { reviewHref } from "./paths";
import { can, capabilitiesFor, type Capability, type ReviewerRole } from "./permissions";

const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

export type ReviewerProfile = {
  user_id: string;
  display_name: string;
  role: ReviewerRole;
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

/** Require a logged-in, active portal account; redirect to login otherwise.
 *  This establishes only IDENTITY — it grants nothing on its own. Every page
 *  and action must additionally require the capability it needs. */
export async function requireReviewer(): Promise<ReviewerSession> {
  const session = await getReviewerSession();
  if (!session) redirect(reviewHref("/login"));
  return session;
}

/**
 * Require a specific capability — the server-side half of the clearance
 * model, and the ONLY thing that actually enforces it. The nav and dashboards
 * hide what a person can't reach, but hiding is a courtesy; this is the
 * boundary. Every capability-gated page calls this before reading any data.
 *
 * Someone signed in but not cleared is sent to the portal home rather than to
 * login (they're authenticated, just not authorized — bouncing them to a login
 * form they've already satisfied reads as a broken app).
 */
export async function requireCapability(capability: Capability): Promise<ReviewerSession> {
  const session = await requireReviewer();
  if (!can(session.profile, capability)) redirect(reviewHref(""));
  return session;
}

/** Capability check against the current session without redirecting — for
 *  pages that render differently per clearance rather than denying outright
 *  (e.g. the gene queue: your assignments vs. everyone's). */
export async function sessionCan(capability: Capability): Promise<boolean> {
  const session = await getReviewerSession();
  return session ? can(session.profile, capability) : false;
}

/** The current session's effective capabilities, for handing to client
 *  components so they can hide controls they'd be refused anyway. */
export function sessionCapabilities(session: ReviewerSession): Capability[] {
  return capabilitiesFor(session.profile);
}
