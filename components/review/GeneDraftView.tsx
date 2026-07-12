// Patient-facing renderer for a generated + published gene page (GenePageDraft
// shape). Used BOTH by the public /genetic-insights/[gene] route (when a
// published Supabase version exists) and by the reviewer page's read view, so
// reviewers preview exactly what visitors will see. Presentational only.

import type { GenePageDraft, SourcedText, ResearchCard } from "@/lib/geneResearch/types";

function Section({ title, body }: { title: string; body?: SourcedText }) {
  if (!body?.text) return null;
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-medium text-ink">{title}</h2>
      <p className="mt-2 whitespace-pre-line leading-relaxed text-ink/90">{body.text}</p>
    </section>
  );
}

function Card({ card }: { card: ResearchCard }) {
  return (
    <li className="rounded-lg border border-forest/15 bg-white/60 p-4">
      <h3 className="font-display text-lg font-medium text-forest">{card.title}</h3>
      <dl className="mt-2 space-y-1 text-sm text-ink/90">
        <div>
          <dt className="inline font-semibold">What was studied: </dt>
          <dd className="inline">{card.whatWasStudied}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">What was found: </dt>
          <dd className="inline">{card.whatWasFound}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Why it matters: </dt>
          <dd className="inline">{card.whyItMatters}</dd>
        </div>
        <div className="text-ink/70">
          <dt className="inline font-semibold">Evidence: </dt>
          <dd className="inline">{card.evidenceType}</dd>
          {card.limitation ? <span> — {card.limitation}</span> : null}
        </div>
      </dl>
    </li>
  );
}

export default function GeneDraftView({ draft }: { draft: GenePageDraft }) {
  return (
    <article className="mx-auto max-w-3xl">
      <header>
        <h1 className="font-display text-4xl font-medium text-forest">{draft.gene}</h1>
        {draft.summaryCard?.text ? (
          <p className="mt-3 text-lg leading-relaxed text-ink/90">{draft.summaryCard.text}</p>
        ) : null}
      </header>

      <Section title="What this gene means" body={draft.whatThisGeneMeans} />
      <Section title="How it may affect vision" body={draft.howItMayAffectVision} />
      <Section title="What is known" body={draft.whatIsKnown} />
      <Section title="What is uncertain" body={draft.whatIsUncertain} />
      <Section title="Treatment and research" body={draft.treatmentAndResearch} />
      <Section title="Clinical trial summary" body={draft.clinicalTrialSummary} />
      <Section title="What you can do next" body={draft.whatYouCanDoNext} />
      <Section title="For family and caregivers" body={draft.forFamilyAndCaregivers} />

      {draft.questionsForClinician?.length ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-medium text-ink">
            Questions to ask your clinician
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-ink/90">
            {draft.questionsForClinician.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {draft.researchCards?.length ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-medium text-ink">Research that matters</h2>
          <ul className="mt-3 space-y-3">
            {draft.researchCards.map((c, i) => (
              <Card key={i} card={c} />
            ))}
          </ul>
        </section>
      ) : null}

      {draft.sources?.length ? (
        <section className="mt-8 border-t border-forest/15 pt-4">
          <h2 className="font-display text-lg font-medium text-ink">Sources</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm text-ink/70">
            {draft.sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} className="underline" target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-8 rounded-lg bg-forest/5 p-4 text-sm text-ink/70">
        This information is for education and is not medical advice. Talk with a retinal
        specialist or genetic counselor about your own situation.
      </p>
    </article>
  );
}
