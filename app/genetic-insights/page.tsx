import type { Metadata } from "next";
import Link from "next/link";
import FillerBox from "@/components/FillerBox";
import { geneImages } from "@/lib/geneImages";
import { getGeneGrid } from "@/lib/genesRepo";

export const metadata: Metadata = {
  title: "GENETIC INSIGHTS | RP Hope",
  description:
    "Over time, RP Hope will post academic papers, articles and personal stories for each gene mutation identified as a possible cause of non-syndromic retinitis pigmentosa.",
};

// Re-read on each request so newly published genes appear without a rebuild.
export const dynamic = "force-dynamic";

export default async function GeneticInsightsPage() {
  const { items } = await getGeneGrid();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-teal-dark">
        Genetic Insights
      </h1>
      <p className="mt-4 max-w-4xl leading-relaxed text-teal-dark/90">
        <span className="font-semibold">Gene Insights Project.</span> RP Hope is
        starting a new project. Over time, we will post academic papers, articles
        and personal stories for each gene mutation identified as a possible
        cause of non-syndromic retinitis pigmentosa.
      </p>
      <ul className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/genetic-insights/${g.slug}`}
              className="block rounded-lg border border-teal/15 bg-white p-3 text-center shadow-sm transition hover:border-link hover:shadow-md"
            >
              {geneImages.has(g.slug) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/genes/${g.slug}.jpg`}
                  alt={`${g.display} — Face of RP`}
                  className="aspect-square w-full rounded-md object-cover"
                />
              ) : (
                <FillerBox
                  label={`${g.display} eye`}
                  rounded="rounded-md"
                  className="aspect-square w-full"
                />
              )}
              <span className="mt-3 block font-display text-lg font-bold text-link">
                {g.display}
              </span>
              <span className="block text-xs italic text-teal-dark/70">
                {g.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 text-center">
        <button
          type="button"
          className="text-sm font-semibold text-teal-dark underline"
        >
          Show More
        </button>
      </div>
    </div>
  );
}
