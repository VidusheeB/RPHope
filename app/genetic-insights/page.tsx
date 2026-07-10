import type { Metadata } from "next";
import { getGeneGrid } from "@/lib/genesRepo";
import GeneLibrary from "./GeneLibrary";
import Eyebrow from "@/components/site/Eyebrow";

export const metadata: Metadata = {
  title: "Genetic Insights — RP Hope",
  description:
    "Search 80+ RP-linked genes for clear, jargon-free summaries, inheritance, and where research stands today.",
};

export const dynamic = "force-dynamic";

export default async function GeneticInsightsPage() {
  const { items } = await getGeneGrid();

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <Eyebrow>Genetic Insights</Eyebrow>
        <h1 className="mt-5 font-display text-5xl font-medium tracking-tight text-ink">
          Explore genes linked to RP
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink/70">
          Clear, jargon-free summaries of what each gene means, what research exists,
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
