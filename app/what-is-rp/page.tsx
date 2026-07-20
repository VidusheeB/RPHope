import type { Metadata } from "next";
import Eyebrow from "@/components/site/Eyebrow";
import CTAButton from "@/components/site/CTAButton";
import {
  SourcesList,
  EducationalDisclaimer,
  type Source,
} from "@/components/site/ExplainerNotes";

export const metadata: Metadata = {
  title: "What is retinitis pigmentosa (RP)?",
  description:
    "A clear, everyday-language explainer of retinitis pigmentosa — what it is, how vision changes over time, the genetics behind it, how it's diagnosed, and where research stands.",
};

// Educational explainer summarizing established facts about RP from the
// National Eye Institute (NIH) and MedlinePlus Genetics. Contains medical
// content, so it shows an educational disclaimer, a last-reviewed date, and
// cited sources per content governance. Wording should be verified by a
// reviewer before this is treated as final published copy.
const sources: Source[] = [
  {
    label:
      "National Eye Institute (NIH) — Retinitis Pigmentosa",
    href: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/retinitis-pigmentosa",
  },
  {
    label: "MedlinePlus Genetics — Retinitis pigmentosa",
    href: "https://medlineplus.gov/genetics/condition/retinitis-pigmentosa/",
  },
];

const sections = [
  {
    heading: "What is RP?",
    body: [
      "Retinitis pigmentosa (RP) is a group of rare, inherited eye diseases that affect the retina — the light-sensitive layer of tissue at the back of the eye that turns light into signals your brain reads as sight.",
      "In RP, the cells in the retina slowly break down over time, which gradually reduces vision. It is a genetic condition, meaning people are born with it, and symptoms most often begin in childhood.",
    ],
  },
  {
    heading: "How vision changes over time",
    body: [
      "The usual first sign is trouble seeing at night or in dim light, often noticed in childhood.",
      "Next, side (peripheral) vision narrows, which can create a kind of “tunnel vision.” Over many years, the field of clear vision continues to shrink.",
      "Some people also notice sensitivity to bright light or changes in color vision. RP progresses at very different rates from person to person.",
    ],
  },
  {
    heading: "Causes and genetics",
    body: [
      "RP is caused by changes (variants) in genes that keep retinal cells healthy. Those gene changes are passed from parents to children.",
      "More than 80 different genes have been linked to RP, and it can be inherited in different patterns — autosomal recessive, autosomal dominant, or X-linked. Knowing the specific gene matters, because it shapes how RP progresses and which research and trials may be relevant.",
      "Sometimes RP occurs as part of a broader condition, such as Usher syndrome, which affects both vision and hearing.",
    ],
  },
  {
    heading: "How it's diagnosed",
    body: [
      "Eye doctors use several tests together: a dilated eye exam, visual field testing to map side vision, an electroretinogram (ERG) to measure how the retina responds to light, and OCT imaging for a detailed picture of the retina.",
      "Genetic testing identifies the specific gene involved. This is how the exact form of RP is confirmed — not from symptoms alone.",
    ],
  },
  {
    heading: "Where treatment and research stand",
    body: [
      "There is no cure for most forms of RP yet, but the picture is changing. Low-vision aids and rehabilitation help people make the most of the vision they have.",
      "For one specific genetic form (caused by RPE65 gene changes), an approved gene therapy exists. Many more gene therapies, cell therapies, and other approaches are being studied in clinical trials right now.",
      "This is exactly why RP Hope exists — to track that research gene by gene and help you find studies that may be relevant to review.",
    ],
  },
];

export default function WhatIsRpPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Eyebrow>Understanding RP</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          What is{" "}
          <span className="italic font-medium text-gold">
            retinitis pigmentosa?
          </span>
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-ink/80">
          A rare, inherited eye disease that gradually changes vision — here in
          clear, everyday language.
        </p>

        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 text-lg leading-relaxed text-ink/80">
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <EducationalDisclaimer />

        <p className="mt-4 text-sm text-ink/55">Last reviewed: July 2026</p>

        <SourcesList sources={sources} />

        <div className="mt-12 flex flex-wrap gap-4">
          <CTAButton href="/genetic-insights" variant="primary" arrow>
            Explore genes linked to RP
          </CTAButton>
          <CTAButton href="/what-is-a-clinical-trial" variant="secondary" arrow>
            What is a clinical trial?
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
