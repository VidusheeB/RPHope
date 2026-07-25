"use client";

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
} from "@/app/review/actions";
import { flattenSentencedText, normalizeSentencedText } from "@/lib/geneResearch/types";
import type { GenePageDraft, SentencedText } from "@/lib/geneResearch/types";
import type { FlagResolutionRow } from "@/lib/reviewer/data";

const SECTIONS: { key: keyof GenePageDraft; label: string }[] = [
  { key: "summaryCard", label: "Summary" },
  { key: "whatThisGeneMeans", label: "What this gene means" },
  { key: "howItMayAffectVision", label: "How it may affect vision" },
  { key: "whatIsKnown", label: "What is known" },
  { key: "whatIsUncertain", label: "What is uncertain" },
  { key: "treatmentAndResearch", label: "Treatment and research" },
  { key: "clinicalTrialSummary", label: "Clinical trial summary" },
  { key: "whatYouCanDoNext", label: "What you can do next" },
  { key: "forFamilyAndCaregivers", label: "For family and caregivers" },
];

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
  initialContent: GenePageDraft;
  reviewFlags: string[];
  initialResolutions: FlagResolutionRow[];
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
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [changesNote, setChangesNote] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read-only for the reviewer once submitted/approved — admins can always
  // edit (matches the RLS policy in 0008_review_status_lifecycle.sql).
  const reviewerLocked =
    !props.isAdmin &&
    (props.reviewStatus === "submitted_for_approval" || props.reviewStatus === "approved");

  const flagResolutionInput = {
    draft: content,
    flagCount: props.reviewFlags.length,
    resolutions: Array.from(resolutions.entries()).map(([flagIndex, status]) => ({ flagIndex, status })),
    confirmationChecked: confirmChecked,
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

  const doSave = useCallback(async () => {
    setSaveState("saving");
    const res = await saveDraftAction(props.draftId, serialize(content));
    if (res.ok) {
      setDirty(false);
      setSaveState("saved");
    } else {
      setSaveState("unsaved");
      setPublishMsg(res.error);
    }
  }, [content, props.draftId]);

  // Defensive autosave: debounce edits.
  useEffect(() => {
    if (!dirty) return;
    setSaveState("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, dirty, doSave]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || saveState !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saveState]);

  // INTERIM: this editor still edits a whole section as one text block (the
  // sentence-level side-by-side workspace replaces this component entirely
  // — see the review dashboard rebuild). Editing here collapses the
  // section's sentences into one, preserving the union of their source IDs
  // so nothing gets silently dropped in the meantime.
  function editSection(key: keyof GenePageDraft, text: string) {
    setContent((c) => {
      const prior = normalizeSentencedText(c[key]);
      const sourceIds = Array.from(new Set(prior.sentences.flatMap((s) => s.sourceIds)));
      const next: SentencedText = { sentences: [{ text, sourceIds }] };
      return { ...c, [key]: next };
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
      adminOverride: props.reviewStatus !== "submitted_for_approval",
    });
    if (res.ok) {
      setPublishMsg(`Published. Live at ${res.data?.publishedUrl}`);
      router.refresh();
    } else {
      setPublishMsg([res.error, ...(res.blockers ?? [])].join(" — "));
    }
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
    saveState === "saved" ? "All changes saved" : saveState === "saving" ? "Saving…" : "Unsaved changes";

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between border-b border-ink/10 bg-cream/95 px-5 py-2 text-sm">
        <span className={saveState === "saved" ? "text-forest" : "text-ink/70"}>{statusBadge}</span>
        <button onClick={doSave} className="rounded bg-forest px-3 py-1 font-semibold text-white">
          Save draft
        </button>
      </div>

      {/* Section editors */}
      {SECTIONS.map(({ key, label }) => {
        const section = normalizeSentencedText(content[key]);
        const text = flattenSentencedText(section);
        const sourceIds = Array.from(new Set(section.sentences.flatMap((s) => s.sourceIds)));
        return (
          <section key={String(key)} id={`section-${String(key)}`}>
            <label className="block">
              <span className="font-display text-lg font-medium text-ink">{label}</span>
              <textarea
                value={text}
                onChange={(e) => editSection(key, e.target.value)}
                rows={Math.max(3, Math.ceil(text.length / 90))}
                className="mt-1 w-full rounded border border-ink/20 p-3 leading-relaxed"
              />
            </label>
            {sourceIds.length ? (
              <p className="mt-1 text-xs text-ink/50">Sources: {sourceIds.join(", ")}</p>
            ) : null}
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

      {/* Submit (reviewer) / Approve & Publish + Request changes (admin) */}
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
