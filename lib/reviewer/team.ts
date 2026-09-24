// My Team — the roster.
//
// Service-role throughout (it reads auth.users for email addresses, and
// reviewer_profiles is admin-only under RLS). Every caller must have proven
// `team.view` or `team.manage` first.

import { getServiceSupabase } from "@/lib/supabaseAdmin";
import type { ReviewerRole } from "./permissions";

/** What the roster shows for one person. */
export type TeamMemberStatus = "invited" | "active" | "inactive";

export type TeamMember = {
  userId: string;
  displayName: string;
  email: string | null;
  role: ReviewerRole;
  status: TeamMemberStatus;
  canPublish: boolean;
  /** Open gene assignments — shown so an admin can see what deactivating
   *  someone would strand. */
  activeGenes: number;
  lastActiveAt: string | null;
  invitedAt: string | null;
};

/**
 * Derive a single status for an account. Exported because the precedence is
 * the part worth testing.
 *
 * "Invited" means no password has been set. It is deliberately NOT based on
 * whether they have ever signed in: clicking an invitation link verifies the
 * token and signs the person in, so that signal goes true the moment they open
 * the email, and everyone appeared Active the instant they were invited.
 *
 * There is no "removed" state. Deactivation is the only way a member loses
 * access, and it is always reversible.
 */
export function deriveStatus(input: {
  active: boolean;
  /** Has a password been set? NOT "have they signed in" — opening an
   *  invitation link signs someone in without completing anything. */
  hasActivated: boolean;
}): TeamMemberStatus {
  if (!input.active) return "inactive";
  if (!input.hasActivated) return "invited";
  return "active";
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const service = getServiceSupabase();
  if (!service) return [];

  const [{ data: profiles }, { data: assignments }, authList] = await Promise.all([
    service.from("reviewer_profiles").select("*"),
    service.from("draft_assignments").select("reviewer_id, status"),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  // Email and sign-in history live in auth.users, not reviewer_profiles.
  // Email lives in auth.users, not reviewer_profiles. Sign-in time is
  // deliberately NOT read here — see deriveStatus for why it is the wrong
  // signal for "set up".
  const authById = new Map(
    (authList?.data?.users ?? []).map((u) => [u.id, { email: u.email ?? null }])
  );

  const load = new Map<string, number>();
  for (const a of assignments ?? []) {
    if (a.status === "completed" || a.status === "reassigned") continue;
    load.set(a.reviewer_id, (load.get(a.reviewer_id) ?? 0) + 1);
  }

  return (profiles ?? [])
    .map((p) => {
      const auth = authById.get(p.user_id);
      return {
        userId: p.user_id,
        displayName: p.display_name || "(no name)",
        email: auth?.email ?? null,
        role: p.role as ReviewerRole,
        status: deriveStatus({
          active: p.active,
          hasActivated: Boolean(p.activated_at),
        }),
        canPublish: p.can_publish,
        activeGenes: load.get(p.user_id) ?? 0,
        lastActiveAt: p.last_active_at ?? null,
        invitedAt: p.invited_at ?? null,
      };
    })
    .sort((a, b) => {
      // Inactive members sink to the bottom; otherwise alphabetical.
      if ((a.status === "inactive") !== (b.status === "inactive")) return a.status === "inactive" ? 1 : -1;
      return a.displayName.localeCompare(b.displayName);
    });
}

/**
 * How many admins could still administer the organisation if this person were
 * deactivated or removed.
 *
 * The spec requires that the organisation can never reach zero active admins —
 * that state is unrecoverable through the UI, because the only people who
 * could fix it are the ones who just lost access.
 */
export async function activeAdminsExcluding(userId: string): Promise<number> {
  const service = getServiceSupabase();
  if (!service) return 0;
  const { data } = await service
    .from("reviewer_profiles")
    .select("user_id, role, active")
    .eq("role", "admin")
    .eq("active", true);
  return (data ?? []).filter((r) => r.user_id !== userId).length;
}
