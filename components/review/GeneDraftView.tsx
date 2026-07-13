// Patient-facing renderer for a generated + published gene page (GenePageDraft
// shape). Renders the brief-by-default format: an always-visible summary +
// at-a-glance + "where things stand" status cards, then the long content as
// collapsible sections governed by a Quick read / Full page control. Used by the
// public /genetic-insights/[gene] route when a published Supabase version exists.
// Presentational only.

import type { GenePageDraft, SourcedText, ResearchCard } from "@/lib/geneResearch/types";
import type { ReactNode } from "react";
import {
  IdentityCard,
  StatusCard,
  StatusTrials,
  GeneSection,
  PROSE,
} from "@/components/site/genePageParts";
import ReadingModeToggle from "@/components/site/ReadingModeToggle";

/** First sentence (or a trimmed lead) for a section preview / status card. */
function lead(text?: string, max = 160): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  const dot = clean.indexOf(". ");
  const first = dot > 0 && dot < max + 40 ? clean.slice(0, dot + 1) : clean;
  return first.length > max ? first.slice(0, max).replace(/\s+\S*$/, "") + "…" : first;
}

function ProseSection({ title, body }: { title: string; body?: SourcedText }) {
  if (!body?.text) return null;
  return (
    <GeneSection title={title} preview={lead(body.text)}>
      <p className={`whitespace-pre-line ${PROSE}`}>{body.text}</p>
    </GeneSection>
  );
}

function ResearchCardView({ card }: { card: ResearchCard }) {
  return (
    <li className="rounded-xl border border-ink/10 bg-cream-header p-4">
      <h3 className="font-display text-base font-medium text-forest">{card.title}</h3>
      {card.evidenceType && (
        <span className="mt-1.5 inline-block rounded-md bg-cream-card px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-ink/60">
          {card.evidenceType}
        </span>
      )}
      <dl className="mt-2 space-y-1 text-[0.92rem] text-ink/90">
        {card.whatWasFound && (
          <div>
            <dt className="inline font-bold text-forest-dark">What was found: </dt>
            <dd className="inline">{card.whatWasFound}</dd>
          </div>
        )}
        {card.whyItMatters && (
          <div>
            <dt className="inline font-bold text-forest-dark">Why it matters: </dt>
            <dd className="inline">{card.whyItMatters}</dd>
          </div>
        )}
        {card.limitation && (
          <p className="text-[0.85rem] text-ink/60">Limitation: {card.limitation}</p>
        )}
      </dl>
    </li>
  );
}

export default function GeneDraftView({
  draft,
  geneSlug,
  listenSlot,
  face,
  glance,
}: {
  draft: GenePageDraft;
  geneSlug: string;
  listenSlot?: ReactNode;
  face?: ReactNode;
  glance?: ReactNode;
}) {
  return (
    <div data-gene-scope>
      <IdentityCard
        gene={draft.gene}
        lead={draft.summaryCard?.text}
        listenSlot={listenSlot}
        face={face}
        glance={glance}
      />

      {/* Where things stand */}
      {(draft.treatmentAndResearch?.text || draft.clinicalTrialSummary?.text) && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {draft.treatmentAndResearch?.text && (
            <StatusCard lead="Where things stand · Treatment" title="Treatment & research">
              <p>{lead(draft.treatmentAndResearch.text, 220)}</p>
            </StatusCard>
          )}
          <StatusTrials
            geneSlug={geneSlug}
            summary={draft.clinicalTrialSummary?.text ? lead(draft.clinicalTrialSummary.text, 200) : undefined}
          />
        </div>
      )}

      <div className="mt-6">
        <ReadingModeToggle />
      </div>

      <div className="mt-2 grid gap-3">
        <ProseSection title="What this gene means" body={draft.whatThisGeneMeans} />
        <ProseSection title="How it may affect vision" body={draft.howItMayAffectVision} />
        <ProseSection title="What is known" body={draft.whatIsKnown} />
        <ProseSection title="What is uncertain" body={draft.whatIsUncertain} />
        <ProseSection title="Treatment & research, in depth" body={draft.treatmentAndResearch} />
        <ProseSection title="What you can do next" body={draft.whatYouCanDoNext} />
        <ProseSection title="For family & caregivers" body={draft.forFamilyAndCaregivers} />

        {draft.questionsForClinician?.length ? (
          <GeneSection
            title="Questions to ask your clinician"
            preview="Questions to bring to a retinal specialist or genetic counselor…"
          >
            <ul className={`grid gap-2.5 ${PROSE}`}>
              {draft.questionsForClinician.map((q, i) => (
                <li key={i} className="relative pl-6">
                  <span aria-hidden="true" className="absolute left-0 top-2.5 h-2 w-2 rounded-full bg-gold" />
                  {q}
                </li>
              ))}
            </ul>
          </GeneSection>
        ) : null}

        {draft.researchCards?.length ? (
          <GeneSection
            title="Research that matters"
            preview="Studies behind this page — what was found, why it matters, and its limitation…"
          >
            <ul className="grid gap-3">
              {draft.researchCards.map((c, i) => (
                <ResearchCardView key={i} card={c} />
              ))}
            </ul>
          </GeneSection>
        ) : null}

        {draft.sources?.length ? (
          <GeneSection title="Sources" preview="Peer-reviewed and registry references underlying this page…">
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-ink/70">
              {draft.sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} className="text-forest underline" target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </GeneSection>
        ) : null}
      </div>
    </div>
  );
}
