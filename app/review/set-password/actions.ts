"use server";

// Requesting a fresh invitation after a link has expired.
//
// UNAUTHENTICATED BY NECESSITY. The person calling this could not sign in —
// that is the whole reason they are here — so there is no session to check.
// That makes it a public endpoint, and it is written defensively:
//
//   * It never reveals whether an email has an account. The response is
//     identical either way, so this cannot be used to discover who works at
//     RP Hope.
//   * It notifies, and nothing more. No account is created, changed, or
//     re-invited automatically; an admin decides whether to resend. An
//     endpoint that mailed a fresh login link to any address typed into it
//     would be a way in, not a convenience.
//   * Repeat requests collapse into one notification per person per day via
//     the dedupe key, so this cannot be used to flood an admin's bell.

import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { notify, notifyAdmins } from "@/lib/reviewer/notifications";
import { reviewHref } from "@/lib/reviewer/paths";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RequestResult = { ok: boolean; message: string };

/** Deliberately the same wording for every outcome — found, not found,
 *  already active, misconfigured server. See the enumeration note above. */
const GENERIC =
  "Thanks — if that address has a pending invitation, the administrator who invited you has been notified.";

export async function requestNewInvitationAction(email: string): Promise<RequestResult> {
  const address = email.trim().toLowerCase();
  // A malformed address is the one thing worth saying out loud: it is a typo,
  // not information about anyone's account.
  if (!EMAIL_RE.test(address)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const service = getServiceSupabase();
  if (!service) return { ok: true, message: GENERIC };

  try {
    const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
    const user = data?.users.find((u) => u.email?.toLowerCase() === address);

    // No account, or they already have a working password — either way, say
    // the same thing and do nothing.
    if (!user || user.last_sign_in_at) return { ok: true, message: GENERIC };

    const { data: profile } = await service
      .from("reviewer_profiles")
      .select("display_name, invited_by, active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile || !profile.active) return { ok: true, message: GENERIC };

    const who = profile.display_name?.trim() || address;
    const title = `${who} asked for a new invitation link`;
    const body = "Their invitation link expired or had already been used.";
    // One notification per person per day, however many times they click.
    const dedupeKey = `invite-request:${user.id}:${new Date().toISOString().slice(0, 10)}`;
    const href = reviewHref("/admin/reviewers");

    if (profile.invited_by) {
      // The admin who invited them is the one who knows the context.
      await notify({
        recipient: profile.invited_by,
        type: "invitation_requested",
        title,
        body,
        href,
        dedupeKey,
      });
    } else {
      // Invited before invited_by was recorded, or seeded directly — fall
      // back to the whole admin team rather than dropping the request.
      await notifyAdmins({ type: "invitation_requested", title, body, href, dedupeKey });
    }
  } catch {
    // Never surface an internal failure here; it would leak more than it helps.
  }

  return { ok: true, message: GENERIC };
}
