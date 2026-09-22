"use server";

// Account settings actions — a person managing their OWN account.
//
// Deliberately NOT capability-gated beyond being signed in: changing your own
// password is not a privilege, it is a basic property of having an account.
// Everything here derives the target user from the session, never from client
// input, so there is no way to aim these at somebody else's account.

import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabaseServer";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { requireReviewer } from "@/lib/reviewer/session";
import type { ActionResult } from "@/app/review/actions";

/** Matches Supabase's own default minimum. Kept explicit so the UI can state
 *  the rule up front instead of surfacing a provider error after the fact. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Change the signed-in person's password.
 *
 * Requires the CURRENT password even though Supabase's updateUser() does not.
 * Without that check, anyone who walked up to an unlocked laptop could lock the
 * real owner out of an account that can publish medical content. Verification
 * is a real sign-in attempt against a throwaway client — it must not touch the
 * caller's cookie session, or a failed check would sign them out.
 */
export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  const session = await requireReviewer();
  if (!session.email) return { ok: false, error: "This account has no email address on file." };

  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (input.newPassword === input.currentPassword) {
    return { ok: false, error: "Your new password must be different from your current one." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, error: "Server not configured." };

  // Throwaway client: persistSession/autoRefreshToken off so this sign-in
  // attempt cannot write over the cookie session we are running inside.
  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: session.email,
    password: input.currentPassword,
  });
  if (verifyError) {
    return { ok: false, error: "Your current password isn't right." };
  }

  // Update through the cookie-bound client so Supabase rotates the caller's
  // own session rather than leaving them on a token tied to the old password.
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Server not configured." };
  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/**
 * Update the display name shown next to this person's work across the portal
 * (assignments, approvals, ticket threads, the audit log).
 *
 * reviewer_profiles has no self-update RLS policy on purpose — that is what
 * stops someone editing their own role or can_publish — so this one narrow,
 * self-scoped column write goes through the service-role client, with the
 * user id taken from the session. The patch names exactly one column, so this
 * path cannot be widened into a privilege change by accident.
 */
export async function updateDisplayNameAction(displayName: string): Promise<ActionResult> {
  const session = await requireReviewer();
  const trimmed = displayName.trim();
  if (!trimmed) return { ok: false, error: "Your name can't be empty." };
  if (trimmed.length > 120) return { ok: false, error: "That name is too long." };

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { error } = await service
    .from("reviewer_profiles")
    .update({ display_name: trimmed })
    .eq("user_id", session.userId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
