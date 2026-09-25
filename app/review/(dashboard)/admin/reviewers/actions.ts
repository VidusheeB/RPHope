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
import { checkDeactivationAllowed } from "@/lib/reviewer/team";
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

  const allowed = await checkDeactivationAllowed(userId);
  if (allowed.blocked) return { ok: false, error: allowed.reason };

  const { data: target } = await service
    .from("reviewer_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await service
    .from("reviewer_profiles")
    .update({ active: false })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actor: session.userId,
    action: "reviewer_deactivated",
    reviewerId: userId,
    after: { displayName: target?.display_name ?? null },
  });
  revalidatePath(reviewHref("/admin/reviewers"));
  return { ok: true };
}

export async function reactivateMemberAction(userId: string): Promise<ActionResult> {
  const session = await requireTeamManage();
  if (!session) return { ok: false, error: "You don't have permission to manage the team." };

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { error } = await service
    .from("reviewer_profiles")
    .update({ active: true })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actor: session.userId, action: "reviewer_activated", reviewerId: userId });
  revalidatePath(reviewHref("/admin/reviewers"));
  return { ok: true };
}
