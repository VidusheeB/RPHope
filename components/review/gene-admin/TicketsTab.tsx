"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTicketAction, replyTicketAction } from "@/app/review/ticketActions";
import type { TicketRow } from "@/lib/reviewer/data";
import { TICKET_STATUS_LABELS, TICKET_TYPE_LABELS, isOpenTicketStatus, type TicketStatus } from "@/lib/reviewer/tickets";

const STATUS_OPTIONS: TicketStatus[] = ["open", "acknowledged", "in_progress", "waiting_for_reviewer", "resolved", "closed"];

export default function TicketsTab({ tickets }: { tickets: TicketRow[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  async function setStatus(id: string, status: TicketStatus) {
    await updateTicketAction({ ticketId: id, status });
    router.refresh();
  }

  if (tickets.length === 0) {
    return <p className="rounded-lg border border-ink/10 bg-white p-4 text-sm text-ink/60">No issues reported on this gene.</p>;
  }

  return (
    <ul className="space-y-3">
      {tickets.map((t) => (
        <li key={t.id} className="rounded-lg border border-ink/10 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">
                #{t.ticketNumber} {t.subject}
                {t.blocking && isOpenTicketStatus(t.status) && (
                  <span className="ml-2 rounded-full bg-maroon/15 px-2 py-0.5 text-xs font-bold text-maroon">Blocking</span>
                )}
              </p>
              <p className="mt-1 text-xs text-ink/50">
                {TICKET_TYPE_LABELS[t.type]}
                {t.sectionKey ? ` · ${t.sectionKey}` : ""} · {new Date(t.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-ink/80">{t.description}</p>
            </div>
            <select
              value={t.status}
              onChange={(e) => setStatus(t.id, e.target.value as TicketStatus)}
              className="rounded border border-ink/20 px-2 py-1 text-xs"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((id) => (id === t.id ? null : t.id))}
            className="mt-2 text-xs font-semibold text-forest underline"
          >
            {expanded === t.id ? "Hide reply box" : "Reply"}
          </button>
          {expanded === t.id && <ReplyBox ticketId={t.id} onSent={() => router.refresh()} />}
        </li>
      ))}
    </ul>
  );
}

function ReplyBox({ ticketId, onSent }: { ticketId: string; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    if (!body.trim()) return;
    const res = await replyTicketAction({ ticketId, body });
    if (res.ok) {
      setSent(true);
      setBody("");
      onSent();
    }
  }

  return (
    <div className="mt-2 rounded border border-ink/10 bg-cream-header p-3">
      {sent && <p className="text-xs text-forest">Reply sent.</p>}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Reply…"
        className="w-full rounded border border-ink/15 p-2 text-xs"
      />
      <button
        type="button"
        onClick={send}
        disabled={!body.trim()}
        className="mt-2 rounded bg-forest px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}
