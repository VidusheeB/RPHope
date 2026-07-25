// Audit-trail writer for the reviewer portal. One insert per mutating
// action, called from inside the same server action that already performs
// the mutation — reusing the service-role client each action already holds,
// not a new logging framework or event bus.
//
// Best-effort like notifications: a failed audit insert must never fail the
// underlying action.

import { getServiceSupabase } from "../supabaseAdmin";

export type AuditAction =
  | "reviewer_invited"
  | "reviewer_role_changed"
  | "reviewer_activated"
  | "reviewer_deactivated"
  | "reviewer_publish_permission_changed"
  | "draft_assigned"
  | "draft_content_saved"
  | "flag_resolved"
  | "sentence_verification_saved"
  | "review_submitted"
  | "changes_requested"
  | "draft_published"
  | "gene_unpublished"
  | "ticket_created"
  | "ticket_reply_added"
  | "ticket_updated";

export async function logAudit(input: {
  actor: string | null;
  action: AuditAction;
  draftId?: string;
  reviewerId?: string;
  ticketId?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const service = getServiceSupabase();
  if (!service) return;
  try {
    await service.from("audit_log").insert({
      actor: input.actor,
      action: input.action,
      draft_id: input.draftId ?? null,
      reviewer_id: input.reviewerId ?? null,
      ticket_id: input.ticketId ?? null,
      before_value: input.before ?? null,
      after_value: input.after ?? null,
    });
  } catch {
    // Intentionally swallowed — see module note.
  }
}
