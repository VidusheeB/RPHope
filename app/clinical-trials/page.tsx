import type { Metadata } from "next";
import ClinicalTrialsFinder from "@/components/site/trials/ClinicalTrialsFinder";
import { resolvePreselectedGene } from "@/lib/trials/genePreselect";

export const metadata: Metadata = {
  title: "Clinical Trials Finder — RP Hope",
  description:
    "A guided, global, AI-assisted way to surface clinical trials, registries, and research opportunities that may be relevant to review for retinitis pigmentosa and other inherited retinal diseases. For navigation, not eligibility or medical advice.",
};

export default function ClinicalTrialsPage({
  searchParams,
}: {
  searchParams: { gene?: string | string[] };
}) {
  // A gene-page "Find clinical trials" CTA links here with ?gene=<slug>. Validate
  // it server-side; an unknown/absent value yields null and the Finder starts in
  // its normal default state.
  const raw = Array.isArray(searchParams.gene) ? searchParams.gene[0] : searchParams.gene;
  const initialGene = resolvePreselectedGene(raw);
  return (
    <div className="bg-cream">
      <ClinicalTrialsFinder initialGene={initialGene} />
    </div>
  );
}
