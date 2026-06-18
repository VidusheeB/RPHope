import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { genes, getGene } from "@/lib/genes";
import { geneGrid } from "@/lib/geneGrid";
import { geneImages } from "@/lib/geneImages";

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
    return {
      title: `${gene.gene} | RP Hope`,
      description: gene.summary.slice(0, 155),
    };
  }
  const item = geneGrid.find((g) => g.slug === params.gene);
  if (item) {
    return { title: `${item.display} | RP Hope` };
  }
  return { title: "Gene not found — RP Hope" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="border-b border-teal/10 py-2 leading-relaxed text-teal-dark/90">
      <span className="font-bold text-teal-dark">{label}: </span>
      {children}
    </p>
  );
}

export default function GenePage({ params }: { params: { gene: string } }) {
  const gene = getGene(params.gene);
  const hasImg = geneImages.has(params.gene);

  // Grid-only gene — minimal page mirroring the site's field layout.
  if (!gene) {
    const item = geneGrid.find((g) => g.slug === params.gene);
    if (!item) notFound();
    return (
      <article className="mx-auto max-w-4xl px-4 py-12">
        <Link href="/genetic-insights" className="text-sm font-semibold text-link">
          ← Genetic Insights
        </Link>
        <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-tight text-teal-dark">
          {item.display}
        </h1>
        <div className="mt-6 max-w-2xl">
          <Row label="Disease Category">{item.label}</Row>
        </div>
        <p className="mt-8 text-teal-dark/80">
          Academic papers, articles and personal stories for {item.display} are
          being collected.
        </p>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/genetic-insights" className="text-sm font-semibold text-link">
        ← Genetic Insights
      </Link>

      <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-tight text-teal-dark">
        {gene.gene}
      </h1>

      {/* Field list — mirrors the live gene page */}
      <div className="mt-6 max-w-2xl">
        <Row label="Disease Category">{gene.diseaseCategory}</Row>
        <Row label="Patient Population">
          {gene.patientPopulation || "—"}
        </Row>
        <Row label="Active Clinical Trials">
          {gene.clinicalTrials?.url ? (
            <a
              href={gene.clinicalTrials.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link underline"
            >
              {gene.clinicalTrials.label}
            </a>
          ) : (
            gene.clinicalTrials?.label || "—"
          )}
        </Row>
        <Row label="Treatment Options">{gene.treatmentOptions || "—"}</Row>
        <Row label="Strategies to Preserve Eye Health">
          {gene.eyeHealthStrategies || "—"}
        </Row>
        <Row label="Institution(s) Conducting Research">
          {gene.institutions && gene.institutions.length > 0
            ? gene.institutions.join(", ")
            : "—"}
        </Row>
      </div>

      {/* A Face of RP */}
      {gene.faceOfRP && gene.faceOfRP.name !== "—" && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-teal-dark">
            A Face of RP
          </h2>
          <div className="mt-3 flex items-center gap-4">
            {hasImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/genes/${params.gene}.jpg`}
                alt={`${gene.faceOfRP.name} — a Face of RP for ${gene.gene}`}
                className="h-24 w-24 rounded-full object-cover"
              />
            )}
            <p className="font-semibold text-teal">
              {gene.faceOfRP.name}
              {gene.faceOfRP.location ? ` · ${gene.faceOfRP.location}` : ""}
            </p>
          </div>
        </section>
      )}

      {/* Brief Description */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-teal-dark">
          Brief Description
        </h2>
        <p className="mt-3 leading-relaxed text-teal-dark/90">{gene.summary}</p>
      </section>
    </article>
  );
}
