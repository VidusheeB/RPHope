import type { Metadata } from "next";
import { getGeneGrid } from "@/lib/genesRepo";
import GeneLibrary from "./GeneLibrary";

export const metadata: Metadata = {
  title: "Genetic Insights — RP Hope",
  description:
    "Search 80+ RP-linked genes for plain-English summaries, inheritance, and where research stands today.",
};

export const dynamic = "force-dynamic";

export default async function GeneticInsightsPage() {
  const { items } = await getGeneGrid();

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <span className="inline-flex items-center gap-2 rounded-full bg-forest/10 px-4 py-1.5 text-sm font-semibold text-forest">
          <span aria-hidden="true">⚛</span> Genetic Insights
        </span>
        <h1 className="mt-4 font-display text-5xl font-bold text-ink">
          Explore genes linked to RP
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink/70">
          Plain-English summaries of what each gene means, what research exists,
          and where trials stand today. Tell us what you&rsquo;re looking for, or
          browse the full list below.
        </p>

        <div className="mt-8">
          <GeneLibrary items={items} />
        </div>
      </div>
    </div>
  );
}
