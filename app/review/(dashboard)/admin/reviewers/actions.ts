"use server";

// My Team actions: deactivate, reactivate, and permanent removal.
//
// Every one of these re-checks `team.manage` and re-derives the last-admin
// count from the database. The UI hides what it can, but an organisation
// locking itself out of its own admin tools is unrecoverable through the
// product, so that guard belongs on the server.

import { revalidatePath } from "next/cache";
import { getReviewerSession } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { reviewHref } from "@/lib/reviewer/paths";
import { logAudit } from "@/lib/reviewer/audit";
import { activeAdminsExcluding } from "@/lib/reviewer/team";
import type { ActionResult } from "@/app/review/actions";

async function requireTeamManage() {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "team.manage")) return null;
  return session;
}

/** Temporarily block access. Reversible, and history is untouched. */
export async function deactivateMemberAction(userId: string): Promise<ActionResult> {
  const session = await requireTeamManage();
  if (!session) return { ok: false, error: "You don't have permission to manage the team." };

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { data: target } = await service
    .from("reviewer_profiles")
    .select("role, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "That team member no longer exists." };

  if (target.role === "admin" && (await activeAdminsExcluding(userId)) === 0) {
    return {
      ok: false,
      error:
        "This is the last active administrator. Deactivating them would leave RP Hope with nobody able to manage the portal — make someone else an admin first.",
    };
  }

  const { error } = await service
    .from("reviewer_profiles")
    .update({ active: false })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actor: session.userId,
    action: "reviewer_deactivated",
    reviewerId: userId,
    after: { displayName: target.display_name },
  });
  revalidatePath(reviewHref("/admin/reviewers"));
  return { ok: true };
}

export async function reactivateMemberAction(userId: string): Promise<ActionResult> {
  const session = await requireTeamManage();
  if (!session) return { ok: false, error: "You don't have permission to manage the team." };

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { data: target } = await service
    .from("reviewer_profiles")
    .select("removed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "That team member no longer exists." };

  // Removal is deliberately one-way from the UI — a "reactivate" that silently
  // undid a permanent removal would make the warning on that button a lie.
  if (target.removed_at) {
    return {
      ok: false,
      error: "This person was permanently removed. Invite them again to restore access.",
    };
  }

  const { error } = await service
    .from("reviewer_profiles")
    .update({ active: true })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actor: session.userId, action: "reviewer_activated", reviewerId: userId });
  revalidatePath(reviewHref("/admin/reviewers"));
  return { ok: true };
}

/**
 * Permanently remove a team member.
 *
 * NOT a row delete. reviewer_profiles cascades from auth.users, so deleting
 * the account would erase the profile — and with it the name that every
 * historical approval, publication and ticket resolves through. audit_log.actor
 * has no cascade either, so the delete would simply be refused for anyone who
 * has done work. See 0028.
 *
 * Instead: ban the auth account (they can never sign in again), mark the
 * profile removed, and deactivate it. Access is gone permanently; attribution
 * survives.
 */
export async function removeMemberAction(userId: string): Promise<ActionResult> {
  const session = await requireTeamManage();
  if (!session) return { ok: false, error: "You don't have permission to manage the team." };

  if (userId === session.userId) {
    return { ok: false, error: "You can't remove your own account." };
  }

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { data: target } = await service
    .from("reviewer_profiles")
    .select("role, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "That team member no longer exists." };

  if (target.role === "admin" && (await activeAdminsExcluding(userId)) === 0) {
    return {
      ok: false,
      error:
        "This is the last active administrator. Removing them would leave RP Hope with nobody able to manage the portal — make someone else an admin first.",
    };
  }

  // Provider-level ban first. If the profile update below were to fail, the
  // worst outcome is an account that cannot sign in but still shows on the
  // roster — visible and fixable. Doing it the other way round could leave
  // someone marked removed who can still log in.
  const { error: banError } = await service.auth.admin.updateUserById(userId, {
    ban_duration: "876000h", // ~100 years; Supabase has no explicit "forever"
  });
  if (banError) return { ok: false, error: `Could not revoke access: ${banError.message}` };

  const { error } = await service
    .from("reviewer_profiles")
    .update({
      active: false,
      removed_at: new Date().toISOString(),
      removed_by: session.userId,
    })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actor: session.userId,
    action: "reviewer_removed",
    reviewerId: userId,
    after: { displayName: target.display_name, role: target.role },
  });
  revalidatePath(reviewHref("/admin/reviewers"));
  return { ok: true };
}
