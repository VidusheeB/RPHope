"use client";

// One conversation: chronological messages, a composer, and a context rail.
//
// Reads as support chat rather than an issue tracker — the opening message is
// just the first message in the thread, not a separate "ticket body" form
// field. That framing is the product decision; the schema still calls these
// tickets.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewHref } from "@/lib/reviewer/paths";
import StatusBadge from "@/components/review/ui/StatusBadge";
import { replyAction, updateConversationAction } from "@/app/review/(dashboard)/tickets/actions";
import { TICKET_STATUS_LABELS, type TicketStatus } from "@/lib/reviewer/tickets";
import type { ConversationDetail } from "@/lib/reviewer/conversations";

const STATUSES: TicketStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "waiting_for_reviewer",
  "resolved",
  "closed",
];

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: "Open",
  acknowledged: "Open",
  in_progress: "In Progress",
  waiting_for_reviewer: "Waiting on Reviewer",
  resolved: "Resolved",
  closed: "Resolved",
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ConversationThread({
  conversation,
  canManage,
  admins,
  viewerId,
}: {
  conversation: ConversationDetail;
  canManage: boolean;
  admins: { userId: string; displayName: string }[];
  viewerId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view when the thread grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [conversation.messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await replyAction({
      conversationId: conversation.id,
      body,
      internalNote: internal,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBody("");
    setInternal(false);
    router.refresh();
  }

  async function update(patch: { status?: TicketStatus; assignedAdmin?: string | null }) {
    setBusy(true);
    setError(null);
    const res = await updateConversationAction({ conversationId: conversation.id, ...patch });
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ---- Thread ---- */}
      <div className="min-w-0 flex-1">
        <Link
          href={reviewHref("/tickets")}
          className="text-sm font-semibold text-ink/60 underline-offset-2 hover:text-forest hover:underline lg:hidden"
        >
          ← Conversations
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-xl font-semibold text-forest">{conversation.subject}</h1>
          <StatusBadge status={STATUS_BADGE[conversation.status]} />
        </div>

        <ol className="mt-5 space-y-4">
          {conversation.messages.map((m) => (
            <li key={m.id} className={m.isMine ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] ${m.isMine ? "text-right" : "text-left"}`}>
                <p className="text-xs text-ink/55">
                  <span className="font-semibold text-ink/70">
                    {m.isMine ? "You" : (m.authorName ?? "Team")}
                  </span>{" "}
                  · {when(m.createdAt)}
                  {m.internalNote && (
                    <>
                      {" "}
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                        Internal note
                      </span>
                    </>
                  )}
                </p>
                <div
                  className={`mt-1 inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${
                    m.internalNote
                      ? "border border-amber-200 bg-amber-50 text-amber-950"
                      : m.isMine
                        ? "bg-forest text-white"
                        : "border border-ink/10 bg-white text-ink"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            </li>
          ))}
          <div ref={endRef} />
        </ol>

        {/* ---- Composer ---- */}
        <form onSubmit={send} className="mt-5 rounded-xl border border-ink/10 bg-white p-3">
          <label htmlFor="reply-body" className="sr-only">
            Write a reply
          </label>
          <textarea
            id="reply-body"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a reply…"
            className="w-full resize-y rounded-md border border-ink/15 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {canManage && (
              <label className="flex items-center gap-2 text-xs text-ink/70">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="h-4 w-4 rounded border-ink/30 accent-[#234b43]"
                />
                Internal note — not shown to {conversation.createdByName ?? "the reviewer"}
              </label>
            )}
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="ml-auto h-9 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      </div>

      {/* ---- Context rail ---- */}
      <aside className="w-full shrink-0 lg:w-64">
        <div className="rounded-xl border border-ink/10 bg-white p-4 text-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-ink/45">Details</h2>
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-xs text-ink/55">Gene</dt>
              <dd className="text-ink">
                {conversation.draftId && conversation.geneSymbol ? (
                  <Link
                    href={reviewHref(`/admin/genes/${conversation.draftId}`)}
                    className="font-semibold text-forest underline-offset-2 hover:underline"
                  >
                    {conversation.geneSymbol}
                  </Link>
                ) : (
                  <span className="text-ink/60">General conversation</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink/55">Opened by</dt>
              <dd className="text-ink">{conversation.createdByName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink/55">Assigned to</dt>
              <dd className="text-ink">
                {conversation.assignedAdminName ?? <span className="text-ink/60">Unassigned</span>}
              </dd>
            </div>
          </dl>

          {canManage && (
            <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
              {/* Ownership is claimed deliberately — opening a conversation
                  never assigns it, so two admins can both read without
                  stepping on each other. */}
              {conversation.assignedAdmin !== viewerId && (
                <button
                  type="button"
                  onClick={() => update({ assignedAdmin: viewerId })}
                  disabled={busy}
                  className="h-9 w-full rounded-md border border-forest px-3 text-sm font-semibold text-forest hover:bg-mint/40 disabled:opacity-50"
                >
                  Assign to me
                </button>
              )}

              <div>
                <label htmlFor="assign-to" className="block text-xs text-ink/55">
                  Assign to
                </label>
                <select
                  id="assign-to"
                  value={conversation.assignedAdmin ?? ""}
                  onChange={(e) => update({ assignedAdmin: e.target.value || null })}
                  disabled={busy}
                  className="mt-1 h-9 w-full rounded-md border border-ink/15 bg-white px-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {admins.map((a) => (
                    <option key={a.userId} value={a.userId}>
                      {a.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="status" className="block text-xs text-ink/55">
                  Status
                </label>
                <select
                  id="status"
                  value={conversation.status}
                  onChange={(e) => update({ status: e.target.value as TicketStatus })}
                  disabled={busy}
                  className="mt-1 h-9 w-full rounded-md border border-ink/15 bg-white px-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TICKET_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              {conversation.status !== "resolved" && (
                <button
                  type="button"
                  onClick={() => update({ status: "resolved" })}
                  disabled={busy}
                  className="h-9 w-full rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-50"
                >
                  Resolve
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
