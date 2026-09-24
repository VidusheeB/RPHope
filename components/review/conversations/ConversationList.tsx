"use client";

// The tickets index — issues raised by the review team.
//
// For a reviewer this is "issues I raised"; for an admin it is the shared team
// inbox. Every admin sees every ticket, delegated or not, because ownership is
// a signal about who is handling something rather than a way to hide it from
// the rest of the team.
//
// NOTE: this is tickets, not direct messaging. A ticket is raised TO the RP
// Hope team and every admin can see it. Private person-to-person messaging is
// a separate feature.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewHref } from "@/lib/reviewer/paths";
import StatusBadge from "@/components/review/ui/StatusBadge";
import { startConversationAction } from "@/app/review/(dashboard)/tickets/actions";
import { isOpenTicketStatus, type TicketStatus } from "@/lib/reviewer/tickets";
import type { ConversationSummary } from "@/lib/reviewer/conversations";

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: "Open",
  acknowledged: "Open",
  in_progress: "In Progress",
  waiting_for_reviewer: "Waiting on Reviewer",
  resolved: "Resolved",
  closed: "Resolved",
};

function relative(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d`;
}

export default function ConversationList({
  conversations,
  canManage,
  viewerId,
}: {
  conversations: ConversationSummary[];
  canManage: boolean;
  viewerId: string;
}) {
  const router = useRouter();
  const [showResolved, setShowResolved] = useState(false);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolved conversations are filtered out of the active view, never deleted
  // — the spec is explicit that they stay searchable history.
  const visible = useMemo(
    () => conversations.filter((c) => showResolved || isOpenTicketStatus(c.status)),
    [conversations, showResolved]
  );
  const resolvedCount = conversations.length - conversations.filter((c) => isOpenTicketStatus(c.status)).length;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await startConversationAction({ subject, body });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setComposing(false);
    setSubject("");
    setBody("");
    router.push(reviewHref(`/tickets/${res.data!.id}`));
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">Tickets</h1>
          <p className="mt-1 text-sm text-ink/60">
            {canManage
              ? "Issues raised by the review team. Every admin sees all of these."
              : "Issues you've raised with the RP Hope team."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposing((v) => !v)}
          className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90"
        >
          New ticket
        </button>
      </div>

      {composing && (
        <form onSubmit={start} className="mt-5 rounded-xl border border-ink/10 bg-white p-4">
          <label htmlFor="new-subject" className="block text-sm font-semibold text-ink">
            Subject
          </label>
          <input
            id="new-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's this about?"
            className="mt-1.5 h-10 w-full rounded-md border border-ink/15 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
          />
          <label htmlFor="new-body" className="mt-3 block text-sm font-semibold text-ink">
            Message
          </label>
          <textarea
            id="new-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-ink/15 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
          />
          <p className="mt-2 text-xs text-ink/55">
            To ask about a specific gene, use “Report an issue” from that gene’s page — the gene is
            attached automatically.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="h-9 rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink/70 hover:bg-ink/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !subject.trim() || !body.trim()}
              className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-40"
            >
              {busy ? "Raising…" : "Raise ticket"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      )}

      {resolvedCount > 0 && (
        <label className="mt-5 flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="h-4 w-4 rounded border-ink/30 accent-[#234b43]"
          />
          Show resolved ({resolvedCount})
        </label>
      )}

      <ul className="mt-4 divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10 bg-white">
        {visible.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-ink/60">
            {conversations.length === 0
              ? "No tickets yet."
              : "Nothing open. Tick “Show resolved” to see resolved tickets."}
          </li>
        )}

        {visible.map((c) => (
          <li key={c.id}>
            <Link
              href={reviewHref(`/tickets/${c.id}`)}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition hover:bg-mint/20"
            >
              <span className="font-semibold text-ink">{c.subject}</span>
              <StatusBadge status={STATUS_BADGE[c.status]} />
              {c.geneSymbol && (
                // Same contrast correction as StatusBadge's neutral tone: a
                // tinted label at 12px reads as washed out beside the darker
                // text on the row.
                <span className="rounded bg-ink/[0.09] px-1.5 py-0.5 text-xs font-semibold text-ink">
                  {c.geneSymbol}
                </span>
              )}
              {/* Who raised it. An admin triaging a shared inbox needs this
                  before anything else — it was previously only visible after
                  opening the ticket. */}
              {canManage && c.createdByName && (
                <span className="text-xs font-semibold text-ink/75">
                  from {c.createdByName}
                </span>
              )}
              <span className="w-full truncate text-sm text-ink/60 sm:w-auto sm:flex-1">
                {c.lastMessage}
              </span>
              {canManage && (
                <span className="text-xs text-ink/70">
                  {c.assignedAdminName
                    ? c.assignedAdmin === viewerId
                      ? "You're handling this"
                      : `${c.assignedAdminName} is handling this`
                    : "Not delegated"}
                </span>
              )}
              <span className="text-xs text-ink/45">{relative(c.lastMessageAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
