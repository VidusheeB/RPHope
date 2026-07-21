import type { Metadata } from "next";
import Eyebrow from "@/components/site/Eyebrow";
import CTAButton from "@/components/site/CTAButton";
import {
  SourcesList,
  EducationalDisclaimer,
  type Source,
} from "@/components/site/ExplainerNotes";

export const metadata: Metadata = {
  title: "Future therapies for RP",
  description:
    "A clear, everyday-language look at the treatment approaches being researched for retinitis pigmentosa — gene therapy, gene editing, stem cells, optogenetics, and more.",
};

// Educational explainer summarizing treatment approaches in RP research.
// Deliberately kept in plain, everyday language — just enough technical
// vocabulary that a reader recognizes the terms if they see them elsewhere
// (in a gene page or a trial listing), without the denser detail. Contains
// medical/research content, so it carries an educational disclaimer and
// cited sources. Verify wording before treating as final copy.
const sources: Source[] = [
  {
    label: "National Eye Institute (NIH) — Retinitis Pigmentosa",
    href: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/retinitis-pigmentosa",
  },
  {
    label: "FDA — Approved Cellular and Gene Therapy Products",
    href: "https://www.fda.gov/vaccines-blood-biologics/cellular-gene-therapy-products/approved-cellular-and-gene-therapy-products",
  },
];

const approaches = [
  {
    name: "Gene therapy",
    body: "Delivers a working copy of a gene directly into the eye to take over for a copy that isn't working. This is the idea behind the one FDA-approved RP treatment so far, for people with mutations in the RPE65 gene.",
  },
  {
    name: "Gene editing (CRISPR)",
    body: "A tool that can find one exact spot in a person's DNA and correct it — something like a very precise spell-check. Researchers are studying whether it can fix RP-causing mutations directly. The FDA has already approved CRISPR-based treatments for other diseases, showing the technology can become real, approved medicine.",
  },
  {
    name: "Stem cell therapy",
    body: "Uses cells that can grow into many different cell types, including the light-sensing cells RP damages, with the goal of replacing cells that have been lost.",
  },
  {
    name: "Optogenetics",
    body: "Adds a light-sensitive protein to retinal cells that RP hasn't destroyed, giving them a new way to detect light — even in more advanced RP, after the original light-sensing cells are gone.",
  },
  {
    name: "Neuroprotective treatments",
    body: "Medicines designed to protect retinal cells and slow their decline, rather than replace or fix them. The goal is to preserve vision for longer, often alongside other treatments.",
  },
  {
    name: "Other approaches in early research",
    body: "Scientists are also studying antioxidant compounds that protect cells from damage, lab-made proteins that block harmful processes in the retina, and drugs that target the biology behind vision loss. These are earlier-stage ideas, mostly still in the lab or in early clinical research.",
  },
];

export default function FutureTherapiesPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Eyebrow>Understanding research</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Future{" "}
          <span className="italic font-medium text-gold">therapies</span> for
          RP
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-ink/80">
          There's no cure yet for most forms of RP. But researchers are
          actively working on several different approaches — here's what they
          are, in plain language.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
            Approaches being researched
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {approaches.map((a) => (
              <li
                key={a.name}
                className="rounded-lg border border-ink/10 bg-white p-5"
              >
                <h3 className="font-display text-lg font-bold text-ink">
                  {a.name}
                </h3>
                <p className="mt-2 text-ink/80">{a.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-lg bg-forest p-8 text-cream">
          <h2 className="font-display text-2xl font-medium tracking-tight">
            How an idea like this reaches patients
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-cream/90">
            Before any of these approaches can become a treatment a doctor can
            offer, they have to be tested in people through a clinical trial —
            first for safety, then to see whether they actually help. That's
            true even for approaches that look promising in the lab.
          </p>
        </section>

        <EducationalDisclaimer />

        <p className="mt-4 text-sm text-ink/55">Last reviewed: July 2026</p>

        <SourcesList sources={sources} />

        <div className="mt-12 flex flex-wrap gap-4">
          <CTAButton href="/what-is-a-clinical-trial" variant="primary" arrow>
            What is a clinical trial?
          </CTAButton>
          <CTAButton href="/genetic-insights" variant="secondary" arrow>
            Explore genes linked to RP
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
