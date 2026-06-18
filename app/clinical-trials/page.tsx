import type { Metadata } from "next";
import CTAButton from "@/components/site/CTAButton";

export const metadata: Metadata = {
  title: "Clinical Trials — RP Hope",
  description:
    "Find RP clinical trials recruiting now, with eligibility explained in plain English.",
};

const sample = [
  {
    gene: "RPGR",
    title: "Gene therapy for X-linked RP",
    status: "Recruiting",
    detail: "Phase 2/3 · multiple sites · ages 18+",
  },
  {
    gene: "USH2A",
    title: "Antisense oligonucleotide study",
    status: "Recruiting",
    detail: "Phase 1/2 · select sites · ages 12+",
  },
  {
    gene: "RPE65",
    title: "Approved gene therapy follow-up",
    status: "Active",
    detail: "Long-term outcomes · ages 4+",
  },
];

export default function ClinicalTrialsPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-widest text-forest">
          Clinical Trials
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
          Trials, in plain English
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/75">
          We track RP trials recruiting now and translate eligibility into
          language families can act on. Always confirm details on
          ClinicalTrials.gov and with your care team.
        </p>

        <ul className="mt-10 space-y-4">
          {sample.map((t) => (
            <li
              key={t.gene}
              className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-ink">
                  {t.gene} — {t.title}
                </h2>
                <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-forest">
                  {t.status}
                </span>
              </div>
              <p className="mt-2 text-ink/70">{t.detail}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <CTAButton
            href="https://clinicaltrials.gov/search?cond=retinitis+pigmentosa"
            variant="primary"
            arrow
          >
            Search ClinicalTrials.gov
          </CTAButton>
        </div>
        <p className="mt-8 text-sm text-ink/50">
          For education and navigation only — not medical advice. Sample listings
          shown for demonstration.
        </p>
      </div>
    </div>
  );
}
