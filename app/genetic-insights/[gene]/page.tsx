import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGene } from "@/lib/genes";
import { geneGrid } from "@/lib/geneGrid";
import GeneArticles, { type Article } from "@/components/site/GeneArticles";
import articlesByGene from "@/lib/geneArticles.json";

export function generateStaticParams() {
  return geneGrid.map((g) => ({ gene: g.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { gene: string };
}): Metadata {
  const gene = getGene(params.gene);
  if (gene) {
    return { title: `${gene.gene} | RP Hope`, description: gene.summary.slice(0, 155) };
  }
  const item = geneGrid.find((g) => g.slug === params.gene);
  return { title: item ? `${item.display} | RP Hope` : "Gene not found — RP Hope" };
}

function getArticles(slug: string): Article[] {
  const map = articlesByGene as Record<string, Article[]>;
  return map[slug] || [];
}

function FaceOfRP({ name, location }: { name: string; location?: string }) {
  const initial = name.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || "•";
  return (
    <div className="flex shrink-0 flex-col items-center text-center">
      <span className="text-[10px] font-bold uppercase tracking-widest text-forest/70">
        A Face of RP
      </span>
      <span
        aria-hidden="true"
        className="mt-2 grid h-24 w-24 place-items-center rounded-full bg-forest font-display text-3xl font-bold text-white"
      >
        {initial}
      </span>
      <span className="mt-2 font-semibold text-ink">{name}</span>
      {location && <span className="text-sm text-ink/60">{location}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ink/10 py-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-ink/70">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-ink">{children}</dd>
    </div>
  );
}

export default function GenePage({ params }: { params: { gene: string } }) {
  const gene = getGene(params.gene);
  const articles = getArticles(params.gene);

  // Grid-only gene — minimal page.
  if (!gene) {
    const item = geneGrid.find((g) => g.slug === params.gene);
    if (!item) notFound();
    return (
      <div className="bg-cream">
        <article className="mx-auto max-w-5xl px-5 py-12">
          <Link href="/genetic-insights" className="text-sm font-bold text-forest">
            ← Genetic Insights
          </Link>
          <h1 className="mt-4 font-display text-5xl font-bold text-ink">
            {item.display}
          </h1>
          <dl className="mt-8 max-w-md rounded-2xl border border-ink/10 bg-white px-6 py-2 shadow-sm">
            <Field label="Disease Category">{item.label}</Field>
          </dl>
          <section className="mt-12">
            <h2 className="font-display text-3xl font-bold text-ink">In the News</h2>
            <div className="mt-6">
              <GeneArticles articles={articles} />
            </div>
          </section>
          <Disclaimer />
        </article>
      </div>
    );
  }

  return (
    <div className="bg-cream">
      <article className="mx-auto max-w-5xl px-5 py-12">
        <Link href="/genetic-insights" className="text-sm font-bold text-forest">
          ← Genetic Insights
        </Link>

        {/* Header card: name + at-a-glance table + Face of RP */}
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-5xl font-bold text-ink">
                {gene.gene}
              </h1>
              {gene.fullName && (
                <p className="mt-1 text-lg text-ink/60">{gene.fullName}</p>
              )}
            </div>
            {gene.faceOfRP && gene.faceOfRP.name && gene.faceOfRP.name !== "—" && (
              <FaceOfRP
                name={gene.faceOfRP.name}
                location={gene.faceOfRP.location}
              />
            )}
          </div>

          <dl className="mt-6 grid gap-x-10 sm:grid-cols-2">
            <Field label="Disease Category">{gene.diseaseCategory}</Field>
            <Field label="Treatment Options">
              {gene.treatmentOptions || "—"}
            </Field>
            <Field label="Patient Population">
              {gene.patientPopulation || "—"}
            </Field>
            <Field label="Strategies to Preserve Eye Health">
              {gene.eyeHealthStrategies || "—"}
            </Field>
            <Field label="Clinical Trials">
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
            </Field>
            <Field label="Institution(s) Conducting Research">
              {gene.institutions && gene.institutions.length > 0
                ? gene.institutions.join(", ")
                : "—"}
            </Field>
          </dl>
        </div>

        {/* Brief description */}
        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-ink">
            Brief Description
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink/80">
            {gene.summary}
          </p>
        </section>

        {/* In the News */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-bold text-ink">
              In the News
            </h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
              AI-curated from RP Hope&rsquo;s research library
            </span>
          </div>
          <div className="mt-6">
            <GeneArticles articles={articles} />
          </div>
        </section>

        <Disclaimer />
      </article>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="mt-12 border-t border-ink/10 pt-6 text-sm text-ink/50">
      <span className="font-semibold text-ink/70">Medical disclaimer:</span> This
      page is for education and navigation only — not medical advice, diagnosis,
      or treatment. Plain-English summaries are paraphrases of published research;
      always confirm details with a qualified clinician and primary sources.
    </p>
  );
}
