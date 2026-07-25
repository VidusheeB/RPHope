"use client";

// Read-only admin view of the audit trail. Deliberately plain — a list, not
// a data-grid — since this is a rarely-consulted accountability record, not
// a daily-use screen.

import { useState } from "react";
import type { AuditLogRow } from "@/lib/reviewer/data";

const ACTION_LABELS: Record<string, string> = {
  reviewer_invited: "Reviewer invited",
  reviewer_role_changed: "Reviewer role changed",
  reviewer_activated: "Reviewer activated",
  reviewer_deactivated: "Reviewer deactivated",
  reviewer_publish_permission_changed: "Publish permission changed",
  draft_assigned: "Draft assigned",
  draft_content_saved: "Draft content saved",
  flag_resolved: "Review flag resolved",
  sentence_verification_saved: "Sentence verification saved",
  review_submitted: "Review submitted",
  changes_requested: "Changes requested",
  draft_published: "Draft published",
  ticket_created: "Ticket created",
  ticket_reply_added: "Ticket reply added",
  ticket_updated: "Ticket updated",
};

export default function AuditLogView({ entries }: { entries: AuditLogRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-semibold text-forest underline"
      >
        {open ? "Hide audit trail" : `Show audit trail (${entries.length} recent actions)`}
      </button>
      {open && (
        <ul className="mt-3 max-h-[32rem] space-y-1 overflow-y-auto rounded-lg border border-ink/12 bg-white p-3 text-xs">
          {entries.length === 0 && <li className="text-ink/50">No recorded actions yet.</li>}
          {entries.map((e) => (
            <li key={e.id} className="border-b border-ink/5 py-1.5 last:border-0">
              <span className="font-semibold text-ink">{ACTION_LABELS[e.action] ?? e.action}</span>
              <span className="ml-2 text-ink/50">{new Date(e.createdAt).toLocaleString()}</span>
              {e.draftId && <span className="ml-2 text-ink/40">draft {e.draftId.slice(0, 8)}</span>}
              {e.ticketId && <span className="ml-2 text-ink/40">ticket {e.ticketId.slice(0, 8)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
