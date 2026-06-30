import type { Metadata } from "next";
import ClinicalTrialsFinder from "@/components/site/trials/ClinicalTrialsFinder";

export const metadata: Metadata = {
  title: "Clinical Trials Finder — RP Hope",
  description:
    "A guided, global, AI-assisted way to surface clinical trials, registries, and research opportunities that may be relevant to review for retinitis pigmentosa and other inherited retinal diseases. For navigation, not eligibility or medical advice.",
};

export default function ClinicalTrialsPage() {
  return (
    <div className="bg-cream">
      <ClinicalTrialsFinder />
    </div>
  );
}
