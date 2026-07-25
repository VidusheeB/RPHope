"use client";

// Admin ticket inbox — triage every "Report an issue" filing across every
// draft. Reuses the same DashboardList-style filter-tabs + card convention
// as the rest of the reviewer portal rather than a generic data table.

import { useState } from "react";
import Link from "next/link";
import { updateTicketAction, replyTicketAction } from "@/app/review/ticketActions";
import type { TicketRow } from "@/lib/reviewer/data";
import {
  TICKET_STATUS_LABELS,
  TICKET_SEVERITY_LABELS,
  TICKET_TYPE_LABELS,
  isOpenTicketStatus,
  type TicketSeverity,
  type TicketStatus,
} from "@/lib/reviewer/tickets";

type Reviewer = { user_id: string; display_name: string };

const FILTERS: { key: string; label: string; match: (t: TicketRow) => boolean }[] = [
  { key: "open", label: "Open", match: (t) => isOpenTicketStatus(t.status) },
  { key: "blocking", label: "Blocking", match: (t) => t.blocking && isOpenTicketStatus(t.status) },
  { key: "all", label: "All", match: () => true },
  { key: "resolved", label: "Resolved/Closed", match: (t) => !isOpenTicketStatus(t.status) },
];

const STATUS_OPTIONS: TicketStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "waiting_for_reviewer",
  "resolved",
  "closed",
];
const SEVERITY_OPTIONS: TicketSeverity[] = ["low", "normal", "high", "critical"];

export default function TicketInbox({
  tickets: initialTickets,
  reviewers,
}: {
  tickets: (TicketRow & { geneSymbol: string })[];
  reviewers: Reviewer[];
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [filter, setFilter] = useState("open");
  const [expanded, setExpanded] = useState<string | null>(null);
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = tickets.filter(active.match);

  function patch(id: string, fields: Partial<TicketRow>) {
    setTickets((rows) => rows.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }

  async function setStatus(id: string, status: TicketStatus) {
    patch(id, { status });
    await updateTicketAction({ ticketId: id, status });
  }
  async function setSeverity(id: string, severity: TicketSeverity) {
    patch(id, { severity });
    await updateTicketAction({ ticketId: id, severity });
  }
  async function setBlocking(id: string, blocking: boolean) {
    patch(id, { blocking });
    await updateTicketAction({ ticketId: id, blocking });
  }
  async function setAssignee(id: string, assignedAdmin: string) {
    patch(id, { assignedAdmin: assignedAdmin || null });
    await updateTicketAction({ ticketId: id, assignedAdmin: assignedAdmin || null });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter tickets">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.key ? "bg-forest text-white" : "bg-white text-ink/80 border border-ink/15"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-ink/60">No tickets in this view.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {shown.map((t) => (
            <li key={t.id} className="rounded-lg border border-ink/12 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">
                    #{t.ticketNumber} {t.subject}
                    {t.blocking && (
                      <span className="ml-2 rounded-full bg-maroon/15 px-2 py-0.5 text-xs font-bold text-maroon">
                        Blocking
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink/50">
                    {TICKET_TYPE_LABELS[t.type]} · {t.geneSymbol}
                    {t.sectionKey ? ` · ${t.sectionKey}` : ""}
                    {" · "}
                    {new Date(t.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-ink/80">{t.description}</p>
                  <Link
                    href={`/review/${t.draftId}`}
                    className="mt-2 inline-block text-xs font-semibold text-forest underline"
                  >
                    Open draft
                  </Link>
                </div>
                <div className="flex flex-col items-end gap-2">
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
                  <select
                    value={t.severity}
                    onChange={(e) => setSeverity(t.id, e.target.value as TicketSeverity)}
                    className="rounded border border-ink/20 px-2 py-1 text-xs"
                  >
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {TICKET_SEVERITY_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={t.assignedAdmin ?? ""}
                    onChange={(e) => setAssignee(t.id, e.target.value)}
                    className="rounded border border-ink/20 px-2 py-1 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {reviewers.map((r) => (
                      <option key={r.user_id} value={r.user_id}>
                        {r.display_name || r.user_id}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-ink/70">
                    <input
                      type="checkbox"
                      checked={t.blocking}
                      onChange={(e) => setBlocking(t.id, e.target.checked)}
                    />
                    Blocking
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpanded((id) => (id === t.id ? null : t.id))}
                className="mt-3 text-xs font-semibold text-forest underline"
              >
                {expanded === t.id ? "Hide replies" : "Reply / view thread"}
              </button>
              {expanded === t.id && <TicketThread ticketId={t.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketThread({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!body.trim()) return;
    const res = await replyTicketAction({ ticketId, body, internalNote: internal });
    if (res.ok) {
      setSent(true);
      setBody("");
    }
  }

  return (
    <div className="mt-3 rounded border border-ink/10 bg-cream-header p-3">
      {sent && <p className="text-xs text-forest">Reply sent.</p>}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Reply to the reviewer…"
        className="w-full rounded border border-ink/15 p-2 text-xs"
      />
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-1 text-xs text-ink/70">
          <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
          Internal note (admins only, never shown to the reviewer)
        </label>
        <button
          type="button"
          onClick={send}
          disabled={!body.trim()}
          className="rounded bg-forest px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
