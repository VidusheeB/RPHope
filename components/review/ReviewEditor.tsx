"use client";

// The gene review workspace: sentence-to-source verification, side by side.
// Each section renders its sentences on the left, with inline numbered
// citations right in the sentence text (click a number to jump to/highlight
// that source on the right), and the sources those citations point to on
// the right — scoped per section rather than one giant sidebar for the
// whole gene, so the sources shown are always the ones actually relevant to
// what's on screen. Autosave/dirty-tracking/beforeunload-warning are the
// same pattern this file has always used.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  evaluateSubmissionReadiness,
  evaluateAdminPublishReadiness,
  type FlagResolutionStatus,
} from "@/lib/reviewer/publishGate";
import type { DraftReviewStatus } from "@/lib/reviewer/dashboardStatus";
import {
  saveDraftAction,
  resolveFlagAction,
  publishAction,
  submitReviewAction,
  approveReviewAction,
  requestChangesAction,
} from "@/app/review/actions";
import { replyTicketAction } from "@/app/review/ticketActions";
import { normalizeSentencedText, NARRATIVE_SECTION_KEYS } from "@/lib/geneResearch/types";
import type { GenePageDraft, SourceCitation } from "@/lib/geneResearch/types";
import type { FlagResolutionRow, TicketRow } from "@/lib/reviewer/data";
import { TICKET_STATUS_LABELS, TICKET_TYPE_LABELS, isOpenTicketStatus } from "@/lib/reviewer/tickets";
import { findBestMatchingSentence, type SentenceLocation } from "@/lib/reviewer/flagMatch";
import ReportIssueButton from "./ReportIssueButton";

function sentenceDomId(sectionKey: string, sentenceIndex: number): string {
  return `sentence-${sectionKey}-${sentenceIndex}`;
}

const SECTION_LABELS: Record<string, string> = {
  summaryCard: "Summary",
  whatThisGeneMeans: "What this gene means",
  howItMayAffectVision: "How it may affect vision",
  whatIsKnown: "What is known",
  whatIsUncertain: "What is uncertain",
  treatmentAndResearch: "Treatment and research",
  clinicalTrialSummary: "Clinical trial summary",
  whatYouCanDoNext: "What you can do next",
  forFamilyAndCaregivers: "For family and caregivers",
};

function serialize(d: GenePageDraft): Record<string, unknown> {
  return {
    summary_card: d.summaryCard,
    what_this_gene_means: d.whatThisGeneMeans,
    how_it_may_affect_vision: d.howItMayAffectVision,
    what_is_known: d.whatIsKnown,
    what_is_uncertain: d.whatIsUncertain,
    what_you_can_do_next: d.whatYouCanDoNext,
    treatment_and_research: d.treatmentAndResearch,
    clinical_trial_summary: d.clinicalTrialSummary,
    for_family_and_caregivers: d.forFamilyAndCaregivers,
    questions_for_clinician: d.questionsForClinician,
    research_cards: d.researchCards,
    sources: d.sources,
  };
}

export default function ReviewEditor(props: {
  draftId: string;
  geneSlug: string;
  geneSymbol: string;
  initialContent: GenePageDraft;
  reviewFlags: string[];
  initialResolutions: FlagResolutionRow[];
  initialTickets: TicketRow[];
  reviewerCanPublish: boolean;
  isAdmin: boolean;
  reviewStatus: DraftReviewStatus;
}) {
  const router = useRouter();
  const [content, setContent] = useState<GenePageDraft>(props.initialContent);
  const [resolutions, setResolutions] = useState<Map<number, FlagResolutionStatus>>(
    new Map(props.initialResolutions.map((r) => [r.flag_index, r.status]))
  );
  const [notes, setNotes] = useState<Map<number, string>>(
    new Map(props.initialResolutions.map((r) => [r.flag_index, r.reviewer_note ?? ""]))
  );
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const [highlightedSentence, setHighlightedSentence] = useState<SentenceLocation | null>(null);
  const [focusedSection, setFocusedSection] = useState<string | undefined>(undefined);
  const [tickets, setTickets] = useState<TicketRow[]>(props.initialTickets);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Best-guess sentence each AI review flag concerns, so "Go to flagged
  // text" can jump the reviewer straight there instead of a disconnected
  // checklist — see lib/reviewer/flagMatch.ts for why this is a heuristic,
  // not a stored link.
  const sectionsForMatching = NARRATIVE_SECTION_KEYS.map((key) => ({
    sectionKey: String(key),
    sentences: normalizeSentencedText(content[key]).sentences,
  }));
  const flagMatches = props.reviewFlags.map((flag) => findBestMatchingSentence(flag, sectionsForMatching));

  function goToFlag(location: SentenceLocation) {
    setHighlightedSentence(location);
    setFocusedSection(location.sectionKey);
    const el = document.getElementById(sentenceDomId(location.sectionKey, location.sentenceIndex));
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const openBlockingTicketCount = tickets.filter(
    (t) => t.blocking && isOpenTicketStatus(t.status)
  ).length;
  const openTicketCount = tickets.filter((t) => isOpenTicketStatus(t.status)).length;

  const reviewerLocked =
    !props.isAdmin &&
    (props.reviewStatus === "submitted_for_approval" || props.reviewStatus === "approved");

  const flagResolutionInput = {
    draft: content,
    flagCount: props.reviewFlags.length,
    resolutions: Array.from(resolutions.entries()).map(([flagIndex, status]) => ({ flagIndex, status })),
    confirmationChecked: confirmChecked,
    openBlockingTicketCount,
  };
  const submissionReadiness = evaluateSubmissionReadiness({
    ...flagResolutionInput,
    isAssignedReviewer: true, // server re-verifies; page only loads if assigned or admin
  });
  const publishReadiness = evaluateAdminPublishReadiness({
    ...flagResolutionInput,
    isAdmin: props.isAdmin,
    adminCanPublish: props.reviewerCanPublish,
    reviewStatus: props.reviewStatus,
  });

  const doSave = useCallback(async () => {
    setSaveState("saving");
    const res = await saveDraftAction(props.draftId, serialize(content));
    if (res.ok) {
      setDirty(false);
      setSaveState("saved");
      setLastSavedAt(new Date());
    } else {
      setSaveState("error");
      setPublishMsg(res.error);
    }
  }, [content, props.draftId]);

  useEffect(() => {
    if (!dirty) return;
    setSaveState("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, dirty, doSave]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || saveState === "unsaved" || saveState === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saveState]);

  function editSentenceText(sectionKey: keyof GenePageDraft, sentenceIndex: number, text: string) {
    setContent((c) => {
      const section = normalizeSentencedText(c[sectionKey]);
      const nextSentences = section.sentences.map((s, i) => (i === sentenceIndex ? { ...s, text } : s));
      return { ...c, [sectionKey]: { sentences: nextSentences } };
    });
    setDirty(true);
  }

  async function setFlag(index: number, status: FlagResolutionStatus) {
    setResolutions((m) => new Map(m).set(index, status));
    await resolveFlagAction({
      draftId: props.draftId,
      flagIndex: index,
      originalFlagText: props.reviewFlags[index],
      status,
      reviewerNote: notes.get(index) || undefined,
    });
  }

  async function submit() {
    setPublishMsg(null);
    if (dirty || saveState !== "saved") await doSave();
    const res = await submitReviewAction({
      draftId: props.draftId,
      content,
      confirmationChecked: confirmChecked,
    });
    if (res.ok) {
      setPublishMsg("Submitted for admin approval.");
      router.refresh();
    } else {
      setPublishMsg([res.error, ...(res.blockers ?? [])].join(" — "));
    }
  }

  async function publish() {
    setPublishMsg(null);
    if (dirty || saveState !== "saved") await doSave();
    const res = await publishAction({
      draftId: props.draftId,
      content,
      confirmationChecked: confirmChecked,
    });
    if (res.ok) {
      setPublishMsg(`Published. Live at ${res.data?.publishedUrl}`);
      router.refresh();
    } else {
      setPublishMsg([res.error, ...(res.blockers ?? [])].join(" — "));
    }
  }

  async function approve() {
    setPublishMsg(null);
    const res = await approveReviewAction(props.draftId);
    if (res.ok) {
      setPublishMsg("Approved. You can now publish.");
      router.refresh();
    } else {
      setPublishMsg(res.error);
    }
  }

  async function sendRequestChanges() {
    setPublishMsg(null);
    const res = await requestChangesAction({ draftId: props.draftId, note: changesNote });
    if (res.ok) {
      setPublishMsg("Sent back to the reviewer with your note.");
      setChangesNote("");
      setRequestChangesOpen(false);
      router.refresh();
    } else {
      setPublishMsg(res.error);
    }
  }

  async function replyToTicket(ticketId: string, body: string) {
    if (!body.trim()) return;
    const res = await replyTicketAction({ ticketId, body });
    if (res.ok) router.refresh();
    else setPublishMsg(res.error);
  }

  const statusBadge =
    saveState === "saved"
      ? lastSavedAt
        ? `Saved ${lastSavedAt.toLocaleTimeString()}`
        : "All changes saved"
      : saveState === "saving"
        ? "Saving…"
        : saveState === "error"
          ? "Save failed — retry"
          : "Unsaved changes";

  const sourcesById = new Map(content.sources.map((s, i) => [s.id, { source: s, number: i + 1 }]));

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-cream/95 px-5 py-2 text-sm">
        <span
          className={
            saveState === "saved" ? "text-forest" : saveState === "error" ? "text-maroon" : "text-ink/70"
          }
          role="status"
        >
          {statusBadge}
        </span>
        <button onClick={doSave} className="rounded bg-forest px-3 py-1 font-semibold text-white">
          Save draft
        </button>
      </div>

      {/* Sentence-to-source review, section by section */}
      {NARRATIVE_SECTION_KEYS.map((sectionKey) => {
        const { sentences } = normalizeSentencedText(content[sectionKey]);
        const sectionSourceIds = Array.from(new Set(sentences.flatMap((s) => s.sourceIds)));
        const sectionSources = sectionSourceIds
          .map((id) => sourcesById.get(id))
          .filter((x): x is { source: SourceCitation; number: number } => Boolean(x));

        return (
          <section key={String(sectionKey)} id={`section-${String(sectionKey)}`}>
            <h2 className="font-display text-xl font-medium text-ink">
              {SECTION_LABELS[String(sectionKey)]}
            </h2>
            <div className="mt-3 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              {/* Left: sentences, with inline clickable citation numbers */}
              <div className="space-y-1">
                {sentences.map((sentence, i) => (
                  <SentenceRow
                    key={i}
                    id={sentenceDomId(String(sectionKey), i)}
                    sentence={sentence}
                    sourcesById={sourcesById}
                    highlightedSourceId={highlightedSourceId}
                    onHighlightSource={setHighlightedSourceId}
                    highlighted={
                      highlightedSentence?.sectionKey === String(sectionKey) &&
                      highlightedSentence?.sentenceIndex === i
                    }
                    disabled={reviewerLocked}
                    onFocus={() => setFocusedSection(String(sectionKey))}
                    onChangeText={(text) => editSentenceText(sectionKey, i, text)}
                  />
                ))}
              </div>

              {/* Right: sources for this section — the whole card opens the source */}
              <div className="space-y-2">
                {sectionSources.length === 0 && (
                  <p className="text-sm text-ink/50">No sources cited in this section.</p>
                )}
                {sectionSources.map(({ source, number }) => (
                  <a
                    key={source.id}
                    id={`source-${source.id}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`block rounded-lg border p-3 text-sm transition hover:border-forest ${
                      highlightedSourceId === source.id
                        ? "border-forest bg-forest/5"
                        : "border-ink/12 bg-cream-header"
                    }`}
                  >
                    <p className="font-display font-bold text-forest">[{number}] {source.title}</p>
                    <p className="mt-1 text-xs text-ink/60">
                      {[
                        source.authors?.join(", "),
                        source.journal,
                        source.year,
                        source.provenance,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {source.abstract && (
                      <p className="mt-1.5 text-xs text-ink/70">{source.abstract.slice(0, 220)}{source.abstract.length > 220 ? "…" : ""}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-ink/60">
                      {source.pmid && <span>PMID {source.pmid}</span>}
                      {source.doi && <span>DOI {source.doi}</span>}
                      {source.trialId && <span>{source.trialId}</span>}
                      <span className="font-semibold text-forest">Open source →</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* Review flags */}
      <section>
        <h2 className="font-display text-xl font-medium text-ink">
          Review flags ({props.reviewFlags.length})
        </h2>
        <ul className="mt-3 space-y-3">
          {props.reviewFlags.map((flag, i) => {
            const status = resolutions.get(i) ?? "unresolved";
            const match = flagMatches[i];
            return (
              <li key={i} className="rounded-lg border border-ink/12 bg-white p-4">
                <p className="text-sm text-ink/90">{flag}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {match ? (
                    <button
                      type="button"
                      onClick={() => goToFlag(match)}
                      className="rounded border border-forest/30 px-2 py-1 text-xs font-semibold text-forest hover:bg-forest/5"
                    >
                      Go to flagged text ↓
                    </button>
                  ) : (
                    <span className="rounded border border-ink/10 px-2 py-1 text-xs text-ink/40">
                      No matching sentence found
                    </span>
                  )}
                  <button onClick={() => setFlag(i, "wording_confirmed")} className="rounded border border-ink/20 px-2 py-1 text-xs">
                    Keep wording
                  </button>
                  <button onClick={() => setFlag(i, "not_applicable")} className="rounded border border-ink/20 px-2 py-1 text-xs">
                    Mark not applicable
                  </button>
                  <button onClick={() => setFlag(i, "edited_and_resolved")} className="rounded bg-forest px-2 py-1 text-xs font-semibold text-white">
                    Resolve
                  </button>
                </div>
                <input
                  placeholder="Reviewer note (optional)"
                  value={notes.get(i) ?? ""}
                  onChange={(e) => setNotes((m) => new Map(m).set(i, e.target.value))}
                  className="mt-2 w-full rounded border border-ink/15 px-2 py-1 text-xs"
                />
                <p className="mt-1 text-xs">
                  Status:{" "}
                  <span className={status === "unresolved" ? "text-maroon" : "text-forest"}>
                    {status.replace(/_/g, " ")}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Reviewer status banner */}
      {reviewerLocked && !props.isAdmin && (
        <p className="rounded-lg border border-mint bg-mint/40 p-4 text-sm text-forest">
          {props.reviewStatus === "submitted_for_approval"
            ? "Submitted for admin approval — read-only until an admin publishes it or requests changes."
            : "Published."}
        </p>
      )}

      {/* Submit (reviewer) / Approve & Publish (admin) */}
      <section className="rounded-lg border border-forest/20 bg-forest/5 p-4">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} className="mt-1" />
          <span>
            I have reviewed the medical and scientific content against the cited sources and confirm
            that my review is complete.
          </span>
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          {!props.isAdmin && (
            <button
              onClick={submit}
              disabled={!submissionReadiness.canProceed || reviewerLocked}
              className="rounded bg-forest px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit review
            </button>
          )}
          {props.isAdmin && props.reviewStatus === "submitted_for_approval" && (
            <button
              onClick={approve}
              className="rounded bg-forest px-5 py-2 font-semibold text-white"
            >
              Approve
            </button>
          )}
          {props.isAdmin && (props.reviewStatus === "submitted_for_approval" || props.reviewStatus === "changes_requested") && (
            <button
              onClick={() => setRequestChangesOpen(true)}
              className="rounded border border-ink/25 px-5 py-2 font-semibold text-ink"
            >
              Request changes
            </button>
          )}
          {props.isAdmin && (
            <button
              onClick={publish}
              disabled={!publishReadiness.canProceed}
              title={props.reviewStatus !== "approved" ? "Approve the review first" : undefined}
              className="rounded bg-forest px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Publish
            </button>
          )}
        </div>

        {!props.isAdmin && !reviewerLocked && submissionReadiness.blockers.length > 0 && (
          <div className="mt-3 text-sm text-ink/70">
            <p className="font-semibold">Remaining before you can submit:</p>
            <ul className="mt-1 list-disc pl-5">
              {submissionReadiness.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        {props.isAdmin && publishReadiness.blockers.length > 0 && (
          <div className="mt-3 text-sm text-ink/70">
            <p className="font-semibold">Remaining before publishing:</p>
            <ul className="mt-1 list-disc pl-5">
              {publishReadiness.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        {publishMsg ? (
          <p className="mt-3 rounded bg-white p-3 text-sm text-ink/80" role="status">
            {publishMsg}
          </p>
        ) : null}
      </section>

      {/* Tickets filed on this draft */}
      {tickets.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-medium text-ink">Issues reported ({tickets.length})</h2>
          <ul className="mt-3 space-y-3">
            {tickets.map((t) => (
              <TicketCard key={t.id} ticket={t} onReply={(body) => replyToTicket(t.id, body)} />
            ))}
          </ul>
        </section>
      )}

      <ReportIssueButton
        draftId={props.draftId}
        geneSymbol={props.geneSymbol}
        sections={NARRATIVE_SECTION_KEYS.map((k) => ({ key: String(k), label: SECTION_LABELS[String(k)] }))}
        currentSectionKey={focusedSection}
        openTicketCount={openTicketCount}
        onCreated={() => router.refresh()}
      />

      {requestChangesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
          role="presentation"
          onClick={() => setRequestChangesOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Request changes"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"
          >
            <h2 className="font-display text-lg font-medium text-ink">Request changes</h2>
            <p className="mt-1 text-sm text-ink/60">
              Sends this draft back to {props.geneSymbol}&apos;s reviewer with your explanation — required.
            </p>
            <label htmlFor="changes-note" className="sr-only">
              What needs to change
            </label>
            <textarea
              id="changes-note"
              autoFocus
              value={changesNote}
              onChange={(e) => setChangesNote(e.target.value)}
              rows={4}
              placeholder="What needs to change before this can be approved?"
              className="mt-3 w-full rounded border border-ink/20 p-3"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={sendRequestChanges}
                disabled={!changesNote.trim()}
                className="rounded bg-forest px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send back with note
              </button>
              <button
                onClick={() => setRequestChangesOpen(false)}
                className="rounded border border-ink/20 px-4 py-2 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SentenceRow({
  id,
  sentence,
  sourcesById,
  highlightedSourceId,
  onHighlightSource,
  highlighted,
  disabled,
  onFocus,
  onChangeText,
}: {
  id: string;
  sentence: { text: string; sourceIds: string[] };
  sourcesById: Map<string, { source: SourceCitation; number: number }>;
  highlightedSourceId: string | null;
  onHighlightSource: (id: string) => void;
  highlighted: boolean;
  disabled: boolean;
  onFocus: () => void;
  onChangeText: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <textarea
        id={id}
        autoFocus
        value={sentence.text}
        disabled={disabled}
        onFocus={onFocus}
        onChange={(e) => onChangeText(e.target.value)}
        onBlur={() => setEditing(false)}
        rows={Math.max(1, Math.ceil(sentence.text.length / 70))}
        className="w-full resize-none rounded border border-forest/40 bg-white p-2 text-sm leading-relaxed"
      />
    );
  }

  return (
    <p
      id={id}
      onClick={() => {
        if (!disabled) {
          onFocus();
          setEditing(true);
        }
      }}
      className={`rounded p-2 text-sm leading-relaxed transition ${
        highlighted ? "bg-butter/60 ring-2 ring-gold" : ""
      } ${disabled ? "text-ink/70" : "cursor-text text-ink/90 hover:bg-white"}`}
    >
      {sentence.text}{" "}
      {sentence.sourceIds.map((id) => {
        const entry = sourcesById.get(id);
        if (!entry) return null;
        return (
          <sup key={id} className="ml-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onHighlightSource(id);
                document.getElementById(`source-${id}`)?.scrollIntoView({ block: "nearest" });
              }}
              className={`rounded px-0.5 font-bold ${
                highlightedSourceId === id ? "bg-forest text-white" : "text-forest hover:underline"
              }`}
            >
              [{entry.number}]
            </button>
          </sup>
        );
      })}
    </p>
  );
}

const TICKET_STATUS_STYLE: Record<string, string> = {
  open: "bg-maroon/15 text-maroon",
  acknowledged: "bg-butter text-ink",
  in_progress: "bg-butter text-ink",
  waiting_for_reviewer: "bg-lilac text-ink",
  resolved: "bg-mint text-forest",
  closed: "bg-ink/10 text-ink/60",
};

function TicketCard({ ticket, onReply }: { ticket: TicketRow; onReply: (body: string) => void }) {
  const [reply, setReply] = useState("");
  return (
    <li className="rounded-lg border border-ink/12 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">
          #{ticket.ticketNumber} {ticket.subject}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TICKET_STATUS_STYLE[ticket.status]}`}>
          {TICKET_STATUS_LABELS[ticket.status]}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink/50">
        {TICKET_TYPE_LABELS[ticket.type]}
        {ticket.sectionKey ? ` · ${ticket.sectionKey}` : ""}
        {ticket.blocking ? " · blocking" : ""}
      </p>
      <p className="mt-2 text-sm text-ink/80">{ticket.description}</p>
      <div className="mt-3 flex gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply…"
          className="flex-1 rounded border border-ink/15 px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={() => {
            onReply(reply);
            setReply("");
          }}
          disabled={!reply.trim()}
          className="rounded border border-ink/20 px-3 py-1 text-xs font-semibold disabled:opacity-50"
        >
          Reply
        </button>
      </div>
    </li>
  );
}
