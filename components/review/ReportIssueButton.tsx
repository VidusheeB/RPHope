"use client";

// "Report an issue" — a persistent floating launcher on every gene review
// page, same bottom-right placement/shape convention as the public site's
// "Talk to RP Hope" voice launcher (components/site/voice-assistant/). This
// is explicitly NOT chat-styled: no conversational framing, no simulated
// replies — it just opens a plain internal form in a drawer, without
// navigating away, so it never disturbs in-progress ReviewEditor edits.

import { useState } from "react";
import { createTicketAction } from "@/app/review/ticketActions";
import {
  TICKET_TYPE_LABELS,
  TICKET_SEVERITY_LABELS,
  type TicketSeverity,
  type TicketType,
} from "@/lib/reviewer/tickets";

const TYPE_OPTIONS = Object.keys(TICKET_TYPE_LABELS) as TicketType[];
const SEVERITY_OPTIONS = Object.keys(TICKET_SEVERITY_LABELS) as TicketSeverity[];

export default function ReportIssueButton(props: {
  draftId: string;
  geneSymbol: string;
  sections: { key: string; label: string }[];
  currentSectionKey?: string;
  openTicketCount: number;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(props.openTicketCount);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<TicketType>("scientific_accuracy");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [sectionKey, setSectionKey] = useState(props.currentSectionKey ?? "");
  const [severity, setSeverity] = useState<TicketSeverity>("normal");
  const [blocking, setBlocking] = useState(false);

  function resetForm() {
    setType("scientific_accuracy");
    setSubject("");
    setDescription("");
    setSectionKey(props.currentSectionKey ?? "");
    setSeverity("normal");
    setBlocking(false);
    setSubmitted(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await createTicketAction({
      draftId: props.draftId,
      type,
      subject,
      description,
      sectionKey: sectionKey || undefined,
      severity,
      blocking,
      pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
      setCount((c) => c + 1);
      props.onCreated?.();
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ink/20 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-lg transition hover:border-forest hover:text-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
        aria-haspopup="dialog"
      >
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
        Report an issue
        {count > 0 && (
          <span className="rounded-full bg-maroon px-1.5 py-0.5 text-xs font-bold text-white">{count}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report an issue"
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-medium text-ink">Report an issue</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-ink/60 hover:text-ink"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-ink/60">
              This isn&apos;t a chat — it just files an internal note for the admin team about the{" "}
              <strong>{props.geneSymbol}</strong> draft. Your unsaved review edits are untouched.
            </p>

            {submitted ? (
              <div className="mt-6 rounded-lg border border-mint bg-mint/40 p-4 text-sm text-forest">
                <p className="font-semibold">Issue filed.</p>
                <p className="mt-1">An admin will follow up. You can keep reviewing.</p>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setOpen(false);
                  }}
                  className="mt-3 rounded bg-forest px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-ink" htmlFor="ticket-type">
                    Issue type
                  </label>
                  <select
                    id="ticket-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as TicketType)}
                    className="mt-1 w-full rounded border border-ink/20 px-3 py-2"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {TICKET_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ink" htmlFor="ticket-subject">
                    Subject
                  </label>
                  <input
                    id="ticket-subject"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Short summary of the problem"
                    className="mt-1 w-full rounded border border-ink/20 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ink" htmlFor="ticket-description">
                    Description
                  </label>
                  <p className="mt-0.5 text-xs text-ink/60">
                    Be specific — what did you expect, and what did you see instead? Include the
                    exact sentence or source if this concerns scientific accuracy.
                  </p>
                  <textarea
                    id="ticket-description"
                    required
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. The 'What is known' section cites PMID 12345 for a claim about inheritance pattern, but that paper is about treatment response, not inheritance."
                    className="mt-1 w-full rounded border border-ink/20 p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ink" htmlFor="ticket-section">
                    Affected section (optional)
                  </label>
                  <select
                    id="ticket-section"
                    value={sectionKey}
                    onChange={(e) => setSectionKey(e.target.value)}
                    className="mt-1 w-full rounded border border-ink/20 px-3 py-2"
                  >
                    <option value="">Not section-specific</option>
                    {props.sections.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ink" htmlFor="ticket-severity">
                    Severity (optional)
                  </label>
                  <select
                    id="ticket-severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as TicketSeverity)}
                    className="mt-1 w-full rounded border border-ink/20 px-3 py-2"
                  >
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {TICKET_SEVERITY_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={blocking}
                    onChange={(e) => setBlocking(e.target.checked)}
                    className="mt-1"
                  />
                  <span>This issue prevents me from completing the review.</span>
                </label>

                {error && <p className="text-sm text-maroon">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {submitting ? "Filing…" : "File issue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded border border-ink/20 px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
