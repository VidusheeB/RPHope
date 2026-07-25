"use client";

// The gene review workspace: sentence-to-source verification, side by side.
// Each section renders its sentences on the left, each with numbered
// citation badges, and the sources those citations point to on the right —
// scoped per section rather than one giant sidebar for the whole gene, so
// the sources shown are always the ones actually relevant to what's on
// screen. Autosave/dirty-tracking/beforeunload-warning are the same pattern
// this file has always used; they now cover sentence-level edits too.

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
  requestChangesAction,
  saveSentenceReviewAction,
} from "@/app/review/actions";
import { replyTicketAction } from "@/app/review/ticketActions";
import { normalizeSentencedText, NARRATIVE_SECTION_KEYS } from "@/lib/geneResearch/types";
import type { GenePageDraft, SourceCitation } from "@/lib/geneResearch/types";
import type { FlagResolutionRow, TicketRow } from "@/lib/reviewer/data";
import {
  verificationProgress,
  type SentenceReviewRow,
  type SentenceVerificationStatus,
} from "@/lib/reviewer/sentenceVerification";
import { TICKET_STATUS_LABELS, TICKET_TYPE_LABELS, isOpenTicketStatus } from "@/lib/reviewer/tickets";
import ReportIssueButton from "./ReportIssueButton";

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

const VERIFICATION_LABELS: Record<SentenceVerificationStatus, string> = {
  unreviewed: "Unreviewed",
  verified_as_written: "Verified as written",
  edited_and_verified: "Edited and verified",
  removed: "Removed",
  not_applicable: "Not applicable",
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

function reviewKey(sectionKey: string, sentenceIndex: number): string {
  return `${sectionKey}:${sentenceIndex}`;
}

export default function ReviewEditor(props: {
  draftId: string;
  geneSlug: string;
  geneSymbol: string;
  initialContent: GenePageDraft;
  reviewFlags: string[];
  initialResolutions: FlagResolutionRow[];
  initialSentenceReviews: SentenceReviewRow[];
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
  const [sentenceReviews, setSentenceReviews] = useState<Map<string, SentenceReviewRow>>(
    new Map(props.initialSentenceReviews.map((r) => [reviewKey(r.sectionKey, r.sentenceIndex), r]))
  );
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [changesNote, setChangesNote] = useState("");
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const [focusedSection, setFocusedSection] = useState<string | undefined>(undefined);
  const [tickets, setTickets] = useState<TicketRow[]>(props.initialTickets);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openBlockingTicketCount = tickets.filter(
    (t) => t.blocking && isOpenTicketStatus(t.status)
  ).length;
  const openTicketCount = tickets.filter((t) => isOpenTicketStatus(t.status)).length;

  const reviewerLocked =
    !props.isAdmin &&
    (props.reviewStatus === "submitted_for_approval" || props.reviewStatus === "approved");

  // Flat list of every sentence's current verification status, for the
  // overall progress readout and the submission gate.
  const allSentenceStates = NARRATIVE_SECTION_KEYS.flatMap((key) => {
    const { sentences } = normalizeSentencedText(content[key]);
    return sentences.map((s, i) => {
      const row = sentenceReviews.get(reviewKey(String(key), i));
      return { sourceIds: s.sourceIds, status: row?.status ?? "unreviewed" };
    });
  });
  const progress = verificationProgress(allSentenceStates);

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
    adminOverride: props.reviewStatus !== "submitted_for_approval",
  });
  // Sentence verification is a submission requirement even though the pure
  // gate function (shared with the admin publish gate) doesn't know about
  // it yet — checked here, surfaced the same way as the other blockers.
  const sentenceBlockers =
    progress.verified < progress.total
      ? [`${progress.total - progress.verified} statement(s) still need verification against their sources.`]
      : [];

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

  async function setSentenceVerification(
    sectionKey: string,
    sentenceIndex: number,
    originalText: string,
    finalText: string,
    sourceIds: string[],
    status: SentenceVerificationStatus,
    note?: string
  ) {
    const key = reviewKey(sectionKey, sentenceIndex);
    setSentenceReviews((m) => {
      const next = new Map(m);
      next.set(key, {
        sectionKey,
        sentenceIndex,
        originalText,
        finalText,
        originalSourceIds: sourceIds,
        finalSourceIds: sourceIds,
        status,
        reviewerNote: note ?? m.get(key)?.reviewerNote ?? null,
        reviewedBy: null,
        reviewedAt: null,
      });
      return next;
    });
    await saveSentenceReviewAction({
      draftId: props.draftId,
      sectionKey,
      sentenceIndex,
      originalText,
      finalText,
      originalSourceIds: sourceIds,
      finalSourceIds: sourceIds,
      requestedStatus: status,
      reviewerNote: note,
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
      setPublishMsg([res.error, ...(res.blockers ?? []), ...sentenceBlockers].join(" — "));
    }
  }

  async function publish() {
    setPublishMsg(null);
    if (dirty || saveState !== "saved") await doSave();
    const res = await publishAction({
      draftId: props.draftId,
      content,
      confirmationChecked: confirmChecked,
      adminOverride: props.reviewStatus !== "submitted_for_approval",
    });
    if (res.ok) {
      setPublishMsg(`Published. Live at ${res.data?.publishedUrl}`);
      router.refresh();
    } else {
      setPublishMsg([res.error, ...(res.blockers ?? [])].join(" — "));
    }
  }

  async function replyToTicket(ticketId: string, body: string) {
    if (!body.trim()) return;
    const res = await replyTicketAction({ ticketId, body });
    if (res.ok) router.refresh();
    else setPublishMsg(res.error);
  }

  async function requestChanges() {
    setPublishMsg(null);
    const res = await requestChangesAction({ draftId: props.draftId, note: changesNote });
    if (res.ok) {
      setPublishMsg("Sent back to the reviewer with your note.");
      setChangesNote("");
      router.refresh();
    } else {
      setPublishMsg(res.error);
    }
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
        <span className="text-ink/60">
          {progress.verified} of {progress.total} statements verified
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
              {/* Left: sentences */}
              <div className="space-y-3">
                {sentences.map((sentence, i) => {
                  const key = reviewKey(String(sectionKey), i);
                  const row = sentenceReviews.get(key);
                  const status = row?.status ?? "unreviewed";
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-ink/12 bg-white p-3"
                    >
                      <textarea
                        value={sentence.text}
                        disabled={reviewerLocked}
                        onFocus={() => setFocusedSection(String(sectionKey))}
                        onChange={(e) =>
                          editSentenceText(sectionKey, i, e.target.value)
                        }
                        onBlur={() =>
                          setSentenceVerification(
                            String(sectionKey),
                            i,
                            sentence.text,
                            sentence.text,
                            sentence.sourceIds,
                            status,
                            row?.reviewerNote ?? undefined
                          )
                        }
                        rows={Math.max(1, Math.ceil(sentence.text.length / 70))}
                        className="w-full resize-none rounded border border-ink/15 p-2 text-sm leading-relaxed disabled:bg-ink/5"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {sentence.sourceIds.map((id) => {
                          const entry = sourcesById.get(id);
                          if (!entry) return null;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setHighlightedSourceId(id)}
                              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                highlightedSourceId === id
                                  ? "bg-forest text-white"
                                  : "bg-mint text-forest hover:bg-forest/20"
                              }`}
                            >
                              [{entry.number}]
                            </button>
                          );
                        })}
                        {sentence.sourceIds.length === 0 && (
                          <span className="text-xs text-ink/40">No citation</span>
                        )}
                        <select
                          value={status}
                          disabled={reviewerLocked}
                          onChange={(e) =>
                            setSentenceVerification(
                              String(sectionKey),
                              i,
                              sentence.text,
                              sentence.text,
                              sentence.sourceIds,
                              e.target.value as SentenceVerificationStatus,
                              row?.reviewerNote ?? undefined
                            )
                          }
                          className="ml-auto rounded border border-ink/20 px-2 py-1 text-xs disabled:bg-ink/5"
                        >
                          {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        placeholder="Reviewer note (optional)"
                        defaultValue={row?.reviewerNote ?? ""}
                        disabled={reviewerLocked}
                        onBlur={(e) =>
                          setSentenceVerification(
                            String(sectionKey),
                            i,
                            sentence.text,
                            sentence.text,
                            sentence.sourceIds,
                            status,
                            e.target.value
                          )
                        }
                        className="mt-2 w-full rounded border border-ink/15 px-2 py-1 text-xs disabled:bg-ink/5"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Right: sources for this section */}
              <div className="space-y-2">
                {sectionSources.length === 0 && (
                  <p className="text-sm text-ink/50">No sources cited in this section.</p>
                )}
                {sectionSources.map(({ source, number }) => (
                  <div
                    key={source.id}
                    id={`source-${source.id}`}
                    className={`rounded-lg border p-3 text-sm transition ${
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
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                      {source.pmid && <span>PMID {source.pmid}</span>}
                      {source.doi && <span>DOI {source.doi}</span>}
                      {source.trialId && <span>{source.trialId}</span>}
                      <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-forest underline">
                        Open source
                      </a>
                    </div>
                  </div>
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
            return (
              <li key={i} className="rounded-lg border border-ink/12 bg-white p-4">
                <p className="text-sm text-ink/90">{flag}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setFlag(i, "wording_confirmed")} className="rounded border border-ink/20 px-2 py-1 text-xs">
                    Keep wording
                  </button>
                  <a href={`#section-summaryCard`} className="rounded border border-ink/20 px-2 py-1 text-xs">
                    Edit section
                  </a>
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
              disabled={!submissionReadiness.canProceed || sentenceBlockers.length > 0 || reviewerLocked}
              className="rounded bg-forest px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit review
            </button>
          )}
          {props.isAdmin && (
            <button
              onClick={publish}
              disabled={!publishReadiness.canProceed}
              className="rounded bg-forest px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve &amp; Publish
            </button>
          )}
        </div>

        {!props.isAdmin && !reviewerLocked && (submissionReadiness.blockers.length > 0 || sentenceBlockers.length > 0) && (
          <div className="mt-3 text-sm text-ink/70">
            <p className="font-semibold">Remaining before you can submit:</p>
            <ul className="mt-1 list-disc pl-5">
              {[...submissionReadiness.blockers, ...sentenceBlockers].map((b, i) => (
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

      {/* Request changes — admin only */}
      {props.isAdmin && (
        <section className="rounded-lg border border-ink/12 bg-white p-4">
          <h2 className="font-display text-lg font-medium text-ink">Request changes</h2>
          <p className="mt-1 text-sm text-ink/60">
            Sends this draft back to the reviewer with your explanation — required.
          </p>
          <textarea
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
            rows={3}
            placeholder="What needs to change before this can be approved?"
            className="mt-2 w-full rounded border border-ink/20 p-3"
          />
          <button
            onClick={requestChanges}
            disabled={!changesNote.trim()}
            className="mt-2 rounded border border-ink/25 px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send back with note
          </button>
        </section>
      )}
    </div>
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
