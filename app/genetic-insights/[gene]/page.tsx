import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGene, type Gene } from "@/lib/genes";
import { geneGrid } from "@/lib/geneGrid";
import GeneArticles, { type Article } from "@/components/site/GeneArticles";
import ListenButton from "@/components/site/ListenButton";
import { getResearchItems } from "@/lib/researchRepo";
import { getPublishedGeneVersion } from "@/lib/reviewer/publicContent";
import GeneDraftView from "@/components/review/GeneDraftView";
import type { GenePageDraft } from "@/lib/geneResearch/types";
import {
  GENE_COL,
  PROSE,
  GeneCrumb,
  GeneField,
  FaceOfRP,
  IdentityCard,
  StatusCard,
  StatusTrials,
  GeneSection,
  GeneFooter,
} from "@/components/site/genePageParts";

export function generateStaticParams() {
  return geneGrid.map((g) => ({ gene: g.slug }));
}

// Re-render at most hourly so newly-approved (published) research items appear
// without a redeploy, while pages still benefit from static generation.
export const revalidate = 3600;

export function generateMetadata({ params }: { params: { gene: string } }): Metadata {
  const gene = getGene(params.gene);
  if (gene) {
    return { title: `${gene.gene} | RP Hope`, description: gene.summary.slice(0, 155) };
  }
  const item = geneGrid.find((g) => g.slug === params.gene);
  return { title: item ? `${item.display} | RP Hope` : "Gene not found — RP Hope" };
}

/** Verbatim listen text for legacy genes (published fields only — no paraphrase). */
function readableGeneText(gene: Gene, articles: Article[]): string {
  const parts: string[] = [];
  parts.push(gene.fullName ? `${gene.gene}. ${gene.fullName}.` : `${gene.gene}.`);
  if (gene.diseaseCategory) parts.push(`Disease category: ${gene.diseaseCategory}.`);
  if (gene.patientPopulation) parts.push(`Patient population: ${gene.patientPopulation}.`);
  if (gene.treatmentOptions) parts.push(`Treatment options: ${gene.treatmentOptions}.`);
  if (gene.eyeHealthStrategies)
    parts.push(`Strategies to preserve eye health: ${gene.eyeHealthStrategies}.`);
  if (gene.summary) parts.push(`Brief description. ${gene.summary}`);
  if (articles.length > 0) {
    parts.push("In the news.");
    for (const a of articles) parts.push(`${a.title.replace(/\.?$/, ".")}`);
  }
  return parts.join(" ");
}

/** Verbatim listen text for a published generated gene page. */
function readableDraftText(draft: GenePageDraft): string {
  const parts: string[] = [draft.gene + "."];
  const push = (label: string, t?: { text?: string }) => {
    if (t?.text) parts.push(`${label}. ${t.text}`);
  };
  push("Summary", draft.summaryCard);
  push("What this gene means", draft.whatThisGeneMeans);
  push("How it may affect vision", draft.howItMayAffectVision);
  push("What is known", draft.whatIsKnown);
  push("What is uncertain", draft.whatIsUncertain);
  push("Treatment and research", draft.treatmentAndResearch);
  push("Clinical trial summary", draft.clinicalTrialSummary);
  push("What you can do next", draft.whatYouCanDoNext);
  push("For family and caregivers", draft.forFamilyAndCaregivers);
  return parts.join(" ");
}

/** Shared "In the News" section (research items), same look for every gene. */
function InTheNews({ articles, showSource }: { articles: Article[]; showSource?: boolean }) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl font-medium tracking-tight text-ink">In the News</h2>
        {showSource && (
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            AI-curated from RP Hope&rsquo;s research library
          </span>
        )}
      </div>
      <div className="mt-6">
        <GeneArticles articles={articles} />
      </div>
    </section>
  );
}

export default async function GenePage({ params }: { params: { gene: string } }) {
  const articles = await getResearchItems(params.gene);

  // ---- Branch A: a human-reviewed, PUBLISHED Supabase version exists ----------
  // Prefer it; render the rich, brief-by-default format. Immutable — later edits
  // create a new draft + version, never edit this in place.
  const published = await getPublishedGeneVersion(params.gene);
  if (published) {
    const draft = published.content;
    const meta = getGene(params.gene); // structured extras when the gene also has legacy data
    const grid = geneGrid.find((g) => g.slug === params.gene);
    const glance = (
      <>
        {(grid?.label || meta?.diseaseCategory) && (
          <GeneField label="Disease Category">{meta?.diseaseCategory || grid?.label}</GeneField>
        )}
        {meta?.patientPopulation && (
          <GeneField label="Patient Population">{meta.patientPopulation}</GeneField>
        )}
        {meta?.institutions?.length ? (
          <GeneField label="Institution(s) Conducting Research">
            {meta.institutions.join(", ")}
          </GeneField>
        ) : null}
      </>
    );
    return (
      <div className="bg-cream">
        <article className={`${GENE_COL} px-5 py-12`}>
          <GeneCrumb />
          <div className="mt-2">
            <GeneDraftView
              draft={draft}
              geneSlug={params.gene}
              listenSlot={<ListenButton text={readableDraftText(draft)} />}
              face={
                meta?.faceOfRP?.name && meta.faceOfRP.name !== "—" ? (
                  <FaceOfRP name={meta.faceOfRP.name} location={meta.faceOfRP.location} gene={draft.gene} />
                ) : undefined
              }
              glance={glance}
            />
          </div>
          <div className={GENE_COL}>
            <InTheNews articles={articles} showSource />
            <GeneFooter lastReviewed="published, human-reviewed version" />
          </div>
        </article>
      </div>
    );
  }

  // ---- Branch B: legacy full content from genesData.json ----------------------
  const gene = getGene(params.gene);
  if (gene) {
    const glance = (
      <>
        {/* "Disease Category" mirrors the live site, where this field holds the
            inheritance pattern (a deliberate content choice — kept, not "fixed"). */}
        <GeneField label="Disease Category">{gene.diseaseCategory}</GeneField>
        <GeneField label="Patient Population">{gene.patientPopulation || "—"}</GeneField>
        <GeneField label="Clinical Trials">
          {gene.clinicalTrials?.url ? (
            <a
              href={gene.clinicalTrials.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-forest underline"
            >
              {gene.clinicalTrials.label}
            </a>
          ) : (
            gene.clinicalTrials?.label || "—"
          )}
        </GeneField>
        <GeneField label="Institution(s) Conducting Research">
          {gene.institutions?.length ? gene.institutions.join(", ") : "—"}
        </GeneField>
      </>
    );
    // Only substantial free-text fields become collapsible sections.
    const hasEyeHealth = !!gene.eyeHealthStrategies && gene.eyeHealthStrategies.length > 40;
    return (
      <div className="bg-cream">
        <article className={`${GENE_COL} px-5 py-12`} data-gene-scope>
          <GeneCrumb />
          <IdentityCard
            gene={gene.gene}
            fullName={gene.fullName}
            listenSlot={<ListenButton text={readableGeneText(gene, articles)} />}
            face={
              gene.faceOfRP?.name && gene.faceOfRP.name !== "—" ? (
                <FaceOfRP name={gene.faceOfRP.name} location={gene.faceOfRP.location} gene={gene.gene} />
              ) : undefined
            }
            glance={glance}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {gene.treatmentOptions && gene.treatmentOptions !== "—" && (
              <StatusCard lead="Where things stand · Treatment" title="Treatment options">
                <p>{gene.treatmentOptions}</p>
              </StatusCard>
            )}
            <StatusTrials geneSlug={params.gene} />
          </div>

          <div className="mt-6 grid gap-3">
            <GeneSection title="Brief description" preview="A clear, everyday-language overview of this gene." defaultOpen>
              <p className={`text-lg ${PROSE}`}>{gene.summary}</p>
            </GeneSection>
            {hasEyeHealth && (
              <GeneSection
                title="Strategies to preserve eye health"
                preview="Everyday steps that may help protect remaining vision."
              >
                <p className={PROSE}>{gene.eyeHealthStrategies}</p>
              </GeneSection>
            )}
          </div>

          <InTheNews articles={articles} showSource />
          <GeneFooter />
        </article>
      </div>
    );
  }

  // ---- Branch C: grid-only gene (in the grid, no detailed content yet) ---------
  const item = geneGrid.find((g) => g.slug === params.gene);
  if (!item) notFound();
  return (
    <div className="bg-cream">
      <article className={`${GENE_COL} px-5 py-12`}>
        <GeneCrumb />
        <IdentityCard
          gene={item.display}
          glance={<GeneField label="Disease Category">{item.label}</GeneField>}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <StatusTrials geneSlug={params.gene} />
        </div>
        <p className="mt-6 rounded-xl border border-ink/12 bg-white p-5 text-ink/70">
          A clear, everyday-language overview of this gene is being prepared and will appear here
          once reviewed.
        </p>
        <InTheNews articles={articles} showSource />
        <GeneFooter />
      </article>
    </div>
  );
}
